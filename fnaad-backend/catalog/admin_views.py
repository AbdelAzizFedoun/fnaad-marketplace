from rest_framework import generics, permissions, status
from rest_framework.response import Response
from django.utils import timezone

from .models import Product, ProductModerationEvent, SiteSettings, CreationEvidence
from accounts.push import create_notification
from .serializers import ProductSerializer, SiteSettingsSerializer
from .permissions import IsSuperAdmin


class FlaggedCopiesListView(generics.ListAPIView):
    serializer_class = ProductSerializer
    permission_classes = [IsSuperAdmin]

    def get_queryset(self):
        return Product.objects.filter(flagged_as_copy=True).select_related(
            'artist', 'artist__user', 'copy_of', 'copy_of__artist', 'copy_of__artist__user'
        ).prefetch_related('images', 'copy_of__images')


class ConfirmCopyView(generics.UpdateAPIView):
    queryset = Product.objects.filter(flagged_as_copy=True)
    serializer_class = ProductSerializer
    permission_classes = [IsSuperAdmin]

    def patch(self, request, *args, **kwargs):
        product = self.get_object()
        # Increment strikes on the submitting artist
        if product.artist:
            artist = product.artist
            artist.copy_strikes = artist.copy_strikes + 1
            if artist.copy_strikes >= 3 and not artist.is_suspended:
                artist.is_suspended = True
                artist.suspended_at = timezone.now()
                artist.suspension_reason = "Repeated confirmed copyright violations (copies of other artists' work)"
            artist.save(update_fields=['copy_strikes', 'is_suspended', 'suspended_at', 'suspension_reason'])
        product.flagged_as_copy = False
        product.status = Product.STATUS_REJECTED
        product.is_public_visible = False
        product.approved_at = None
        product.rejection_reason = product.rejection_reason or "Identified as a copy of another artist's published work."
        product.save(update_fields=['flagged_as_copy', 'status', 'is_public_visible', 'approved_at', 'rejection_reason'])
        ProductModerationEvent.objects.create(
            product=product, actor=request.user,
            action=ProductModerationEvent.ACTION_CONFIRMED_COPY,
            reason=product.rejection_reason,
            metadata={'copy_of_id': product.copy_of_id, 'confidence': product.copy_confidence},
        )
        create_notification(
            product.artist.user, "Artwork rejected as copy",
            f'"{product.title}" was identified as a copy and rejected. Repeated violations may suspend your account.',
            "copy_review", {"product_id": product.id, "status": Product.STATUS_REJECTED, "copy_confirmed": True},
        )
        return Response(ProductSerializer(product, context={'request': request}).data)


class OverruleCopyView(generics.UpdateAPIView):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    permission_classes = [IsSuperAdmin]

    def patch(self, request, *args, **kwargs):
        product = self.get_object()
        product.flagged_as_copy = False
        product.copy_of = None
        product.copy_confidence = None
        product.status = Product.STATUS_PENDING
        product.rejection_reason = ''
        product.save(update_fields=['flagged_as_copy', 'copy_of', 'copy_confidence', 'status', 'rejection_reason'])
        ProductModerationEvent.objects.create(
            product=product, actor=request.user,
            action=ProductModerationEvent.ACTION_OVERRULED_COPY,
            reason=request.data.get('reason', 'Admin overruled automated copy detection.'),
        )
        create_notification(
            product.artist.user, "Copy review cleared",
            f'"{product.title}" passed the copy review and is awaiting normal admin approval.',
            "product_status", {"product_id": product.id, "status": Product.STATUS_PENDING, "copy_confirmed": False},
        )
        return Response(ProductSerializer(product, context={'request': request}).data)


class EvidenceReviewListView(generics.ListAPIView):
    permission_classes = [IsSuperAdmin]

    def list(self, request, *args, **kwargs):
        products = Product.objects.filter(creation_evidence__isnull=False).select_related('artist', 'artist__user', 'copy_of', 'copy_of__artist').prefetch_related('creation_evidence', 'images').distinct()
        data = []
        for product in products:
            data.append({
                'id': product.id,
                'title': product.title,
                'artist_name': product.artist.brand_name,
                'artist_id': product.artist_id,
                'copy_strikes': product.artist.copy_strikes,
                'verification_level': product.verification_level,
                'creation_method': product.creation_method,
                'passport_token': str(product.passport_token),
                'flagged_as_copy': product.flagged_as_copy,
                'copy_confidence': product.copy_confidence,
                'copy_of_title': product.copy_of.title if product.copy_of_id else None,
                'copy_of_artist': product.copy_of.artist.brand_name if product.copy_of_id else None,
                'images': [{'sha256': image.image_file_sha256, 'phash': image.image_phash, 'dhash': image.image_dhash} for image in product.images.all()],
                'evidence': [{'id': item.id, 'file': request.build_absolute_uri(item.evidence_file.url), 'note': item.note, 'is_reviewed': item.is_reviewed, 'approved': item.approved, 'created_at': item.created_at} for item in product.creation_evidence.all()],
            })
        return Response(data)


class EvidenceReviewDecisionView(generics.UpdateAPIView):
    queryset = CreationEvidence.objects.all()
    permission_classes = [IsSuperAdmin]

    def patch(self, request, *args, **kwargs):
        evidence = self.get_object()
        approved = bool(request.data.get('approved'))
        evidence.is_reviewed = True
        evidence.approved = approved
        evidence.save(update_fields=['is_reviewed', 'approved'])
        product = evidence.product
        if approved:
            product.verification_level = Product.VERIFICATION_VERIFIED
            product.save(update_fields=['verification_level'])
        return Response({'evidence_id': evidence.id, 'approved': approved, 'verification_level': product.verification_level})
