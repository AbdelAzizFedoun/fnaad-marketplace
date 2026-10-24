from datetime import timedelta
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.db import transaction

from accounts.models import ArtistProfile
from catalog.models import Product
from .models import SubscriptionPlan, Subscription, ProductSubscriptionPayment


class SubscriptionPlanListView(generics.ListAPIView):
    queryset = SubscriptionPlan.objects.filter(is_active=True).order_by("plan_type", "billing_cycle_days", "price")
    serializer_class = None

    def get(self, request, *args, **kwargs):
        data = []
        for p in self.get_queryset():
            item = {
                "id": p.id,
                "name": p.name,
                "plan_type": p.plan_type,
                "description": p.description,
                "price": float(p.price) if p.price else 0,
                "billing_cycle_days": p.billing_cycle_days,
                "price_per_product": float(p.price_per_product) if p.price_per_product else 0,
                "product_visibility_days": p.product_visibility_days,
            }
            data.append(item)
        return Response(data)


class SubscribePlan1View(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if not getattr(user, "is_artist", False) or not hasattr(user, "artist_profile"):
            return Response({"detail": "Only artists can subscribe."}, status=403)
        artist = user.artist_profile
        plan_id = request.data.get("plan_id")
        plan = get_object_or_404(SubscriptionPlan, id=plan_id, plan_type=SubscriptionPlan.PLAN_TYPE_PLAN1, is_active=True)

        now = timezone.now()
        ends_at = now + timedelta(days=plan.billing_cycle_days)
        with transaction.atomic():
            sub = Subscription.objects.create(
                artist=artist,
                plan=plan,
                status=Subscription.STATUS_ACTIVE,
                starts_at=now,
                ends_at=ends_at,
                amount_paid=float(plan.price),
                transaction_reference=request.data.get("transaction_reference", ""),
                notes=request.data.get("notes", ""),
            )
            # Make existing products visible if approved
            artist.products.filter(status=Product.STATUS_APPROVED).update(is_public_visible=True, public_visibility_expires_at=None)

        return Response({"status": "subscribed", "subscription_id": sub.id, "ends_at": ends_at.isoformat()})


class PayForProductPlan2View(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user
        if not getattr(user, "is_artist", False) or not hasattr(user, "artist_profile"):
            return Response({"detail": "Only artists can pay for product visibility."}, status=403)
        artist = user.artist_profile
        product_id = request.data.get("product_id")
        product = get_object_or_404(Product, id=product_id, artist=artist)

        plan = SubscriptionPlan.objects.filter(plan_type=SubscriptionPlan.PLAN_TYPE_PLAN2, is_active=True).first()
        if not plan:
            return Response({"detail": "Plan 2 is not configured."}, status=400)

        now = timezone.now()
        ends_at = now + timedelta(days=plan.product_visibility_days)

        with transaction.atomic():
            payment = ProductSubscriptionPayment.objects.create(
                artist=artist,
                product=product,
                plan=plan,
                status=ProductSubscriptionPayment.PAYMENT_STATUS_PAID,
                amount=float(plan.price_per_product),
                visibility_ends_at=ends_at,
                transaction_reference=request.data.get("transaction_reference", ""),
                paid_at=now,
                notes=request.data.get("notes", ""),
            )
            product.is_public_visible = True
            product.public_visibility_expires_at = ends_at
            product.published_under_free_trial = False
            product.save(update_fields=["is_public_visible", "public_visibility_expires_at", "published_under_free_trial"])

        return Response({"status": "paid", "payment_id": payment.id, "visibility_ends_at": ends_at.isoformat()})


class MySubscriptionStatusView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if not getattr(user, "is_artist", False) or not hasattr(user, "artist_profile"):
            return Response({"is_artist": False})
        artist = user.artist_profile
        now = timezone.now()
        trial_active = artist.free_trial_ends_at and artist.free_trial_ends_at > now
        days_left = None
        if trial_active:
            days_left = (artist.free_trial_ends_at - now).days
        active_plan1 = artist.subscriptions.filter(status="active", starts_at__lte=now, ends_at__gte=now).order_by("-ends_at").first()
        plan1_ends = active_plan1.ends_at.isoformat() if active_plan1 else None
        return Response({
            "is_artist": True,
            "trial_active": trial_active,
            "trial_ends_at": artist.free_trial_ends_at.isoformat() if artist.free_trial_ends_at else None,
            "trial_days_left": days_left,
            "has_active_plan1": bool(active_plan1),
            "plan1_ends_at": plan1_ends,
        })
