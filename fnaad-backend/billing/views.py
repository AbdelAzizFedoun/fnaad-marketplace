import re
import uuid

import requests
from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from django.utils import timezone
from datetime import timedelta
from .models import Subscription, SubscriptionPayment
from .serializers import SubscriptionSerializer, AdminSubscriptionStatsSerializer
from catalog.permissions import IsSuperAdmin
from .serializers import SubscriptionSerializer, StartSubscriptionPaymentSerializer, SubscriptionPaymentSerializer, AdminSubscriptionStatsSerializer, SubscriptionPlanSerializer


def get_subscription_plan(plan_id: int):
    for plan in settings.SUBSCRIPTION_PLANS:
        if plan["id"] == plan_id:
            return plan
    return None


REGISTRATION_FEE_XAF = 500


def fapshi_headers():
    if not settings.FAPSHI_APIUSER or not settings.FAPSHI_APIKEY:
        raise RuntimeError("Fapshi is not configured. Set FAPSHI_APIUSER and FAPSHI_APIKEY on the backend.")
    return {"apiuser": settings.FAPSHI_APIUSER, "apikey": settings.FAPSHI_APIKEY}


def normalize_cameroon_phone(value):
    digits = re.sub(r"\D", "", value or "")
    if digits.startswith("00"):
        digits = digits[2:]
    if len(digits) == 9:
        digits = f"237{digits}"
    if not re.fullmatch(r"237[26]\d{8}", digits):
        raise ValueError("Enter a valid Cameroon MTN or Orange number.")
    return digits


def apply_payment_status(payment, payload):
    """Store Fapshi status and grant subscription time only after verified success."""
    provider_status = str(payload.get("status", "")).upper()
    was_successful = payment.status in {"SUCCESSFUL", "SUCCESS", "COMPLETED"}
    if provider_status in {"CREATED", "PENDING", "SUCCESSFUL", "FAILED", "EXPIRED"}:
        payment.status = provider_status
    payment.provider_payload = payload
    if payload.get("transId"):
        payment.provider_transaction_id = str(payload["transId"])
    payment.save(update_fields=["status", "provider_payload", "provider_transaction_id", "updated_at"])
    if provider_status == "SUCCESSFUL" and not was_successful:
        subscription = payment.subscription
        now = timezone.now()
        if payment.is_registration_fee:
            subscription.status = Subscription.STATUS_TRIAL
            subscription.registration_fee_paid = True
            subscription.trial_start_date = now
            subscription.trial_end_date = now + timedelta(days=30)
            subscription.save(update_fields=["status", "registration_fee_paid", "trial_start_date", "trial_end_date"])
            return
        # An early renewal must not discard the artist's remaining access.
        # Start the new plan at the later of the current expiry or payment time.
        renewal_start = max(now, subscription.current_period_end) if subscription.current_period_end else now
        subscription.status = Subscription.STATUS_ACTIVE
        subscription.current_period_end = renewal_start + timedelta(days=30 * payment.duration_months)
        subscription.last_payment_id = payment.provider_transaction_id or payment.external_reference
        subscription.save(update_fields=["status", "current_period_end", "last_payment_id"])


class StartSubscriptionPaymentView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = StartSubscriptionPaymentSerializer

    def post(self, request):
        artist = get_artist_profile_for_user(request.user)
        if artist is None:
            return Response({"detail": "Artist profile required."}, status=status.HTTP_403_FORBIDDEN)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = serializer.validated_data
        plan_id = validated_data.get("plan_id", 1)
        plan = get_subscription_plan(plan_id)
        amount_xaf = plan["price_xaf"]
        if amount_xaf < 100:
            return Response(
                {"amount_xaf": ["Fapshi requires a minimum payment of 100 XAF. Update the subscription prices in the backend environment."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        method = validated_data.get("method")
        try:
            phone = normalize_cameroon_phone(validated_data.get("phone_number") or artist.mobile_money_number)
        except ValueError as exc:
            return Response({"phone_number": [str(exc)]}, status=status.HTTP_400_BAD_REQUEST)

        subscription, _ = Subscription.objects.get_or_create(
            artist=artist, defaults={"trial_end_date": timezone.now(), "registration_fee_paid": False}
        )
        if not subscription.registration_fee_paid:
            return Response({"detail": "Pay the 500 XAF registration fee before subscribing."}, status=400)
        external_reference = f"fnaad-sub-{subscription.pk}-{uuid.uuid4().hex[:16]}"
        payment = SubscriptionPayment.objects.create(
            subscription=subscription, external_reference=external_reference,
            phone_number=phone, amount_xaf=amount_xaf, duration_months=plan["duration_months"],
        )
        try:
            collect_body = {
                "amount": int(payment.amount_xaf),
                "phone": phone[-9:],
                "externalId": external_reference,
                "userId": str(request.user.pk),
                "message": "FNAAD artist subscription",
            }
            if method == "orange":
                collect_body["medium"] = "orange money"
            response = requests.post(
                f"{settings.FAPSHI_BASE_URL.rstrip('/')}/direct-pay",
                headers=fapshi_headers(),
                json=collect_body,
                timeout=20,
            )
            response.raise_for_status()
            payload = response.json()
            if not payload.get("transId"):
                raise ValueError("Fapshi did not return a transaction ID.")
            payment.provider_transaction_id = str(payload["transId"])
            payment.provider_payload = payload
            payment.save(update_fields=["provider_transaction_id", "provider_payload", "updated_at"])
        except (requests.RequestException, RuntimeError, ValueError) as exc:
            payment.status = "FAILED"
            payment.save(update_fields=["status", "updated_at"])
            return Response({"detail": "Could not start the Mobile Money request. Please try again.", "error": str(exc)}, status=502)
        data = SubscriptionPaymentSerializer(payment).data
        data["demo_mode"] = False
        return Response(data, status=status.HTTP_201_CREATED)


class StartRegistrationFeePaymentView(StartSubscriptionPaymentView):
    """Start the separate, non-refundable 500 XAF artist registration fee."""

    def post(self, request):
        artist = get_artist_profile_for_user(request.user)
        if artist is None:
            return Response({"detail": "Artist profile required."}, status=403)
        try:
            phone = normalize_cameroon_phone(request.data.get("phone_number") or artist.mobile_money_number)
        except ValueError as exc:
            return Response({"phone_number": [str(exc)]}, status=400)
        subscription, _ = Subscription.objects.get_or_create(
            artist=artist, defaults={"trial_end_date": timezone.now(), "registration_fee_paid": False}
        )
        if subscription.registration_fee_paid:
            return Response({"detail": "Registration fee already paid."}, status=400)
        external_reference = f"fnaad-reg-{subscription.pk}-{uuid.uuid4().hex[:16]}"
        payment = SubscriptionPayment.objects.create(
            subscription=subscription, external_reference=external_reference,
            phone_number=phone, amount_xaf=REGISTRATION_FEE_XAF, duration_months=0,
            is_registration_fee=True,
        )
        try:
            body = {"amount": REGISTRATION_FEE_XAF, "phone": phone[-9:], "externalId": external_reference, "userId": str(request.user.pk), "message": "FNAAD artist registration fee"}
            if request.data.get("method") in {"orange", "mtn"}:
                body["medium"] = "orange money" if request.data["method"] == "orange" else "mtn mobile money"
            response = requests.post(f"{settings.FAPSHI_BASE_URL.rstrip('/')}/direct-pay", headers=fapshi_headers(), json=body, timeout=20)
            response.raise_for_status()
            payload = response.json()
            if not payload.get("transId"): raise ValueError("Fapshi did not return a transaction ID.")
            payment.provider_transaction_id = str(payload["transId"])
            payment.provider_payload = payload
            payment.save(update_fields=["provider_transaction_id", "provider_payload", "updated_at"])
        except (requests.RequestException, RuntimeError, ValueError) as exc:
            payment.status = "FAILED"
            payment.save(update_fields=["status", "updated_at"])
            return Response({"detail": "Could not start the registration payment.", "error": str(exc)}, status=502)
        data = SubscriptionPaymentSerializer(payment).data
        data["registration_fee_xaf"] = REGISTRATION_FEE_XAF
        return Response(data, status=201)


class SubscriptionPaymentStatusView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SubscriptionPaymentSerializer

    def get_object(self):
        # An unknown or already-settled reference must be a 404, not a 500.
        payment = get_object_or_404(
            SubscriptionPayment.objects.select_related("subscription__artist__user"),
            external_reference=self.kwargs["external_reference"],
        )
        if payment.subscription.artist.user_id != self.request.user.id:
            from django.http import Http404
            raise Http404
        if payment.provider_transaction_id and payment.status not in {"SUCCESSFUL", "FAILED", "EXPIRED"}:
            try:
                result = requests.get(
                    f"{settings.FAPSHI_BASE_URL.rstrip('/')}/payment-status/{payment.provider_transaction_id}",
                    headers=fapshi_headers(),
                    timeout=20,
                )
                result.raise_for_status()
                apply_payment_status(payment, result.json())
            except (requests.RequestException, RuntimeError, ValueError):
                pass
        return payment


class SubscriptionPaymentConfirmView(generics.GenericAPIView):
    """Re-check Fapshi; never treat a client confirmation as proof of payment."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SubscriptionPaymentSerializer

    def post(self, request):
        external_reference = request.data.get("external_reference")
        if not external_reference:
            return Response({"detail": "external_reference is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            payment = SubscriptionPayment.objects.select_related("subscription__artist__user").get(external_reference=external_reference)
        except SubscriptionPayment.DoesNotExist:
            return Response({"detail": "Unknown payment."}, status=status.HTTP_404_NOT_FOUND)
        if payment.subscription.artist.user_id != request.user.id:
            from django.http import Http404
            raise Http404

        if payment.provider_transaction_id and payment.status not in {"SUCCESSFUL", "FAILED", "EXPIRED"}:
            try:
                result = requests.get(
                    f"{settings.FAPSHI_BASE_URL.rstrip('/')}/payment-status/{payment.provider_transaction_id}",
                    headers=fapshi_headers(),
                    timeout=20,
                )
                result.raise_for_status()
                apply_payment_status(payment, result.json())
            except (requests.RequestException, RuntimeError, ValueError):
                pass
        return Response(SubscriptionPaymentSerializer(payment).data, status=status.HTTP_200_OK)


class SubscriptionPlansView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SubscriptionPlanSerializer

    def get(self, request):
        return Response({"plans": settings.SUBSCRIPTION_PLANS, "demo_mode": False})


def get_artist_profile_for_user(user):
    return getattr(user, "artist_profile", None)


class MySubscriptionView(generics.RetrieveAPIView):
    """
    Artist-only: view their own subscription/trial status.
    """
    serializer_class = SubscriptionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        from django.http import Http404
        artist_profile = get_artist_profile_for_user(self.request.user)
        if artist_profile is None:
            raise Http404("Profil artiste introuvable.")
        subscription, _ = Subscription.objects.get_or_create(
            artist=artist_profile,
            defaults={"trial_end_date": timezone.now() + timedelta(days=30)},
        )
        return subscription


class AdminSubscriptionsListView(generics.ListAPIView):
    """
    Staff-only: list all artist subscriptions, for manual activation after
    the artist pays via Mobile Money outside the app.
    """
    serializer_class = SubscriptionSerializer
    permission_classes = [IsSuperAdmin]
    queryset = Subscription.objects.all().select_related("artist", "artist__user").order_by("-trial_start_date")


class AdminActivateSubscriptionView(generics.UpdateAPIView):
    """
    Staff-only: manually activate a subscription (mark as paid) for a set
    number of days, or cancel it.
    Expects PATCH {"action": "activate", "days": 30} or {"action": "cancel"}.
    """
    queryset = Subscription.objects.all()
    serializer_class = SubscriptionSerializer
    permission_classes = [IsSuperAdmin]

    def patch(self, request, *args, **kwargs):
        subscription = self.get_object()
        action = request.data.get("action")

        if action == "activate":
            days = int(request.data.get("days", 30))
            now = timezone.now()
            renewal_start = max(now, subscription.current_period_end) if subscription.current_period_end else now
            subscription.status = Subscription.STATUS_ACTIVE
            subscription.current_period_end = renewal_start + timedelta(days=days)
            subscription.save()
        elif action == "cancel":
            subscription.status = Subscription.STATUS_CANCELLED
            subscription.save()
        else:
            return Response({"detail": "action must be 'activate' or 'cancel'."}, status=400)

        return Response(SubscriptionSerializer(subscription).data)


class AdminSubscriptionStatsView(generics.GenericAPIView):
    permission_classes = [IsSuperAdmin]
    serializer_class = AdminSubscriptionStatsSerializer

    def get(self, request):
        from django.db.models import Count, Q
        qs = Subscription.objects.all()
        stats = qs.aggregate(
            total_artists=Count("id"),
            trial_count=Count("id", filter=Q(status=Subscription.STATUS_TRIAL)),
            active_count=Count("id", filter=Q(status=Subscription.STATUS_ACTIVE)),
            expired_count=Count("id", filter=Q(status=Subscription.STATUS_EXPIRED)),
            cancelled_count=Count("id", filter=Q(status=Subscription.STATUS_CANCELLED)),
        )
        data = {
            "plans": settings.SUBSCRIPTION_PLANS,
            **stats,
        }
        return Response(AdminSubscriptionStatsSerializer(data).data)
