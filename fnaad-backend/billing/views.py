import logging
import re
import uuid
from datetime import timedelta
from decimal import Decimal, InvalidOperation

import jwt
import requests
from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.exceptions import APIException
from rest_framework.response import Response

from catalog.permissions import IsSuperAdmin
from .models import Subscription, SubscriptionPayment
from .serializers import (
    AdminSubscriptionStatsSerializer,
    StartSubscriptionPaymentSerializer,
    SubscriptionPaymentSerializer,
    SubscriptionPlanSerializer,
    SubscriptionSerializer,
)


logger = logging.getLogger(__name__)
CAMPAY_ACCESS_TOKEN_CACHE_KEY = "billing.campay_access_token"


def get_subscription_plan(plan_id: int):
    for plan in settings.SUBSCRIPTION_PLANS:
        if plan["id"] == plan_id:
            return plan
    return None


def fapshi_headers():
    if not settings.FAPSHI_APIUSER or not settings.FAPSHI_APIKEY:
        raise RuntimeError("Fapshi is not configured. Set FAPSHI_APIUSER and FAPSHI_APIKEY on the backend.")
    return {"apiuser": settings.FAPSHI_APIUSER, "apikey": settings.FAPSHI_APIKEY}


def campay_base_url():
    base_url = (settings.CAMPAY_BASE_URL or "").strip().rstrip("/")
    if not base_url:
        raise RuntimeError("CAMPAY_BASE_URL is not configured.")
    return base_url


def campay_headers():
    base_url = campay_base_url()
    token = cache.get(CAMPAY_ACCESS_TOKEN_CACHE_KEY)
    if token:
        return {"Authorization": f"Token {token}"}
    if not settings.CAMPAY_USERNAME or not settings.CAMPAY_PASSWORD:
        raise RuntimeError("CamPay is not configured. Set CAMPAY_USERNAME and CAMPAY_PASSWORD on the backend.")

    response = requests.post(
        f"{base_url}/token/",
        json={"username": settings.CAMPAY_USERNAME, "password": settings.CAMPAY_PASSWORD},
        timeout=20,
    )
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict):
        raise ValueError("CamPay returned an invalid access-token response.")
    token = payload.get("token")
    if not isinstance(token, str) or not token:
        raise ValueError("CamPay did not return an access token.")
    try:
        expires_in = int(payload["expires_in"])
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError("CamPay returned an invalid access-token lifetime.") from exc
    if expires_in <= 0:
        raise ValueError("CamPay returned an invalid access-token lifetime.")
    cache.set(CAMPAY_ACCESS_TOKEN_CACHE_KEY, token, timeout=max(1, expires_in - 60))
    return {"Authorization": f"Token {token}"}


def normalize_cameroon_phone(value):
    digits = re.sub(r"\D", "", value or "")
    if digits.startswith("00"):
        digits = digits[2:]
    if len(digits) == 9:
        digits = f"237{digits}"
    if not re.fullmatch(r"237[26]\d{8}", digits):
        raise ValueError("Enter a valid Cameroon MTN or Orange number.")
    return digits


def validate_campay_transaction(payment, payload):
    if not isinstance(payload, dict):
        raise ValueError("CamPay returned an invalid transaction response.")
    if str(payload.get("reference", "")) != str(payment.provider_transaction_id):
        raise ValueError("CamPay transaction reference did not match the payment.")
    if payload.get("currency") != "XAF":
        raise ValueError("CamPay returned an unexpected transaction currency.")
    try:
        amount = Decimal(str(payload["amount"]))
    except (KeyError, InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError("CamPay returned an invalid transaction amount.") from exc
    if amount != Decimal(payment.amount_xaf):
        raise ValueError("CamPay transaction amount did not match the payment.")
    external_reference = payload.get("external_reference")
    if external_reference and str(external_reference) != payment.external_reference:
        raise ValueError("CamPay external reference did not match the payment.")


class PaymentProviderUnavailable(APIException):
    status_code = status.HTTP_502_BAD_GATEWAY
    default_detail = "Could not verify the payment with the provider. Please try again."
    default_code = "payment_provider_unavailable"


def refresh_payment_status(payment):
    if not payment.provider_transaction_id or payment.status in {"SUCCESSFUL", "FAILED", "EXPIRED"}:
        return payment

    try:
        if payment.provider == SubscriptionPayment.PROVIDER_CAMPAY:
            response = requests.get(
                f"{campay_base_url()}/transaction/{payment.provider_transaction_id}/",
                headers=campay_headers(),
                timeout=20,
            )
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, dict):
                raise ValueError("CamPay returned an invalid payment response.")
            validate_campay_transaction(payment, payload)
        else:
            response = requests.get(
                f"{settings.FAPSHI_BASE_URL.rstrip('/')}/payment-status/{payment.provider_transaction_id}",
                headers=fapshi_headers(),
                timeout=20,
            )
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, dict):
                raise ValueError("Fapshi returned an invalid payment response.")
        apply_payment_status(payment, payload)
        payment.refresh_from_db()
    except (requests.RequestException, RuntimeError, ValueError, TypeError) as exc:
        logger.warning("Payment status verification failed for payment %s: %s", payment.pk, exc)
        raise PaymentProviderUnavailable() from exc
    return payment


@transaction.atomic
def apply_payment_status(payment, payload):
    """Store a provider-verified status and grant subscription time once."""
    payment = SubscriptionPayment.objects.select_for_update().get(pk=payment.pk)
    provider_status = str(payload.get("status", "")).upper()
    was_successful = payment.status in {"SUCCESSFUL", "SUCCESS", "COMPLETED"}
    if provider_status in {"CREATED", "PENDING", "SUCCESSFUL", "FAILED", "EXPIRED"}:
        payment.status = provider_status
    payment.provider_payload = payload
    transaction_id = payload.get("reference") or payload.get("transId")
    if transaction_id:
        payment.provider_transaction_id = str(transaction_id)
    payment.save(update_fields=["status", "provider_payload", "provider_transaction_id", "updated_at"])
    if provider_status == "SUCCESSFUL" and not was_successful:
        subscription = Subscription.objects.select_for_update().get(pk=payment.subscription_id)
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
        try:
            phone = normalize_cameroon_phone(validated_data.get("phone_number") or artist.mobile_money_number)
        except ValueError as exc:
            return Response({"phone_number": [str(exc)]}, status=status.HTTP_400_BAD_REQUEST)

        subscription, _ = Subscription.objects.get_or_create(
            artist=artist, defaults={"trial_end_date": timezone.now()}
        )
        with transaction.atomic():
            subscription = Subscription.objects.select_for_update().get(pk=subscription.pk)
            payment = SubscriptionPayment.objects.filter(
                subscription=subscription,
                provider=SubscriptionPayment.PROVIDER_CAMPAY,
                phone_number=phone,
                amount_xaf=amount_xaf,
                duration_months=plan["duration_months"],
                status="PENDING",
            ).order_by("-created_at").first()
            if payment is None:
                payment = SubscriptionPayment.objects.create(
                    subscription=subscription,
                    external_reference=str(uuid.uuid4()),
                    phone_number=phone,
                    amount_xaf=amount_xaf,
                    duration_months=plan["duration_months"],
                    provider=SubscriptionPayment.PROVIDER_CAMPAY,
                )
        if payment.provider_transaction_id:
            data = SubscriptionPaymentSerializer(payment).data
            data["demo_mode"] = False
            data["ussd_code"] = payment.provider_payload.get("ussd_code")
            data["operator"] = payment.provider_payload.get("operator")
            return Response(data, status=status.HTTP_200_OK)
        try:
            external_reference = payment.external_reference
            collect_body = {
                "amount": int(payment.amount_xaf),
                "currency": "XAF",
                "from": phone,
                "description": "FNAAD artist subscription",
                "external_reference": external_reference,
                "external_user": str(request.user.pk),
            }
            response = requests.post(
                f"{campay_base_url()}/collect/",
                headers=campay_headers(),
                json=collect_body,
                timeout=20,
            )
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, dict):
                raise ValueError("CamPay returned an invalid payment response.")
            if not payload.get("reference"):
                raise ValueError("CamPay did not return a transaction reference.")
            payment.provider_transaction_id = str(payload["reference"])
            payment.provider_payload = payload
            payment.save(update_fields=["provider_transaction_id", "provider_payload", "updated_at"])
        except requests.HTTPError as exc:
            response_status = exc.response.status_code if exc.response is not None else None
            if response_status is not None and 400 <= response_status < 500 and response_status != 409:
                payment.status = "FAILED"
                payment.save(update_fields=["status", "updated_at"])
            logger.warning("CamPay payment initiation failed: %s", exc)
            return Response({"detail": "Could not start the Mobile Money request. Please try again."}, status=502)
        except (requests.RequestException, RuntimeError, ValueError, TypeError) as exc:
            # Keep this reference pending: a network/response failure may have
            # happened after CamPay accepted it, so retries must reuse it.
            logger.warning("CamPay payment initiation failed: %s", exc)
            return Response({"detail": "Could not start the Mobile Money request. Please try again."}, status=502)
        data = SubscriptionPaymentSerializer(payment).data
        data["demo_mode"] = False
        data["ussd_code"] = payload.get("ussd_code")
        data["operator"] = payload.get("operator")
        return Response(data, status=status.HTTP_201_CREATED)


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
        return refresh_payment_status(payment)


class SubscriptionPaymentConfirmView(generics.GenericAPIView):
    """Re-check the payment provider; never trust client-submitted success."""
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

        refresh_payment_status(payment)
        return Response(SubscriptionPaymentSerializer(payment).data, status=status.HTTP_200_OK)


class CamPayWebhookView(generics.GenericAPIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        if not settings.CAMPAY_WEBHOOK_KEY:
            return Response({"detail": "CamPay webhook verification is not configured."}, status=503)
        if not isinstance(request.data, dict):
            return Response({"detail": "CamPay notification must be a JSON object."}, status=400)
        signature = request.data.get("signature")
        if not isinstance(signature, str) or not signature:
            return Response({"detail": "A signed CamPay notification is required."}, status=400)
        try:
            signed_payload = jwt.decode(
                signature,
                settings.CAMPAY_WEBHOOK_KEY,
                algorithms=["HS256"],
            )
        except jwt.InvalidTokenError:
            return Response({"detail": "CamPay notification signature is invalid."}, status=400)

        required_fields = ("reference", "external_reference", "status", "amount", "currency")
        if any(field not in signed_payload for field in required_fields):
            return Response({"detail": "CamPay notification signature is missing required payment data."}, status=400)
        for field in required_fields:
            if str(signed_payload[field]) != str(request.data.get(field, "")):
                return Response({"detail": "CamPay notification data does not match its signature."}, status=400)
        if signed_payload.get("endpoint") != "collect":
            return Response({"detail": "Unsupported CamPay transaction type."}, status=400)

        try:
            payment = SubscriptionPayment.objects.select_related("subscription").get(
                provider=SubscriptionPayment.PROVIDER_CAMPAY,
                external_reference=str(signed_payload["external_reference"]),
            )
        except SubscriptionPayment.DoesNotExist:
            return Response({"detail": "Unknown CamPay payment."}, status=404)
        try:
            validate_campay_transaction(payment, signed_payload)
        except ValueError:
            return Response({"detail": "CamPay transaction does not match the payment."}, status=400)
        if str(signed_payload["status"]).upper() not in {"SUCCESSFUL", "FAILED"}:
            return Response({"detail": "Unsupported CamPay payment status."}, status=400)

        apply_payment_status(payment, signed_payload)
        payment.refresh_from_db()
        return Response({"status": payment.status}, status=status.HTTP_200_OK)


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
