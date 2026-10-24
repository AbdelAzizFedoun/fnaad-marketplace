from datetime import timedelta
from unittest.mock import Mock, patch

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import ArtistProfile, User
from .models import Subscription, SubscriptionPayment
from .views import apply_payment_status


class SuccessfulSubscriptionPaymentTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="artist",
            email="artist@example.com",
            phone_number="690000000",
            password="secure-password",
            role=User.ROLE_ARTIST,
        )
        self.artist = ArtistProfile.objects.create(
            user=self.user,
            brand_name="Test artist",
            mobile_money_number="690000000",
            mobile_money_provider="orange",
        )
        self.subscription = self.artist.subscription

    def test_renewal_adds_to_remaining_subscription_time(self):
        remaining_end = timezone.now() + timedelta(days=8)
        self.subscription.status = Subscription.STATUS_ACTIVE
        self.subscription.current_period_end = remaining_end
        self.subscription.save(update_fields=["status", "current_period_end"])
        payment = SubscriptionPayment.objects.create(
            subscription=self.subscription,
            external_reference="early-renewal",
            phone_number="237690000000",
            amount_xaf=2500,
            duration_months=1,
        )

        apply_payment_status(payment, {"status": "SUCCESSFUL", "transId": "fapshi-early-renewal"})

        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.status, Subscription.STATUS_ACTIVE)
        self.assertEqual(self.subscription.current_period_end, remaining_end + timedelta(days=30))

    def test_repeated_success_callback_does_not_extend_twice(self):
        payment = SubscriptionPayment.objects.create(
            subscription=self.subscription,
            external_reference="idempotent-renewal",
            phone_number="237690000000",
            amount_xaf=2500,
            duration_months=1,
        )
        payload = {"status": "SUCCESSFUL", "transId": "fapshi-idempotent-renewal"}

        apply_successful_payment(payment, payload)
        self.subscription.refresh_from_db()
        first_end_date = self.subscription.current_period_end
        apply_successful_payment(payment, payload)
        self.subscription.refresh_from_db()

        self.assertEqual(self.subscription.current_period_end, first_end_date)


class FapshiSubscriptionPaymentTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="artist-custom-amount",
            email="custom-amount@example.com",
            phone_number="690000001",
            password="secure-password",
            role=User.ROLE_ARTIST,
        )
        self.artist = ArtistProfile.objects.create(
            user=self.user,
            brand_name="Custom amount artist",
            mobile_money_number="690000001",
            mobile_money_provider="orange",
        )
        self.client = APIClient()
        self.client.force_authenticate(self.user)
        self.url = "/api/billing/fapshi/start/"

    @override_settings(
        SUBSCRIPTION_PLANS=[{"id": 2, "duration_months": 2, "price_xaf": 250}],
        FAPSHI_BASE_URL="https://sandbox.fapshi.com",
        FAPSHI_APIUSER="test-user",
        FAPSHI_APIKEY="test-key",
    )
    def test_direct_pay_request_uses_fapshi_credentials_and_transaction_id(self):
        response_mock = Mock()
        response_mock.json.return_value = {"transId": "fapshi-demo-reference"}

        with patch("billing.views.requests.post", return_value=response_mock) as post:
            response = self.client.post(
                self.url,
                {"plan_id": 2, "phone_number": "690000001", "method": "orange"},
                format="json",
            )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["amount_xaf"], 250)
        self.assertEqual(response.data["provider_transaction_id"], "fapshi-demo-reference")
        self.assertEqual(post.call_args.kwargs["json"]["amount"], 250)
        self.assertEqual(post.call_args.kwargs["json"]["medium"], "orange money")

    @override_settings(SUBSCRIPTION_PLANS=[{"id": 2, "duration_months": 2, "price_xaf": 99}])
    def test_plan_below_fapshi_minimum_is_rejected(self):
        response = self.client.post(
            self.url,
            {"plan_id": 2, "phone_number": "690000001", "method": "orange"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(SubscriptionPayment.objects.exists())
