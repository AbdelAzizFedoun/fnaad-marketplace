import uuid
from datetime import timedelta
from unittest.mock import Mock, patch

import jwt
import requests
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import ArtistProfile, User
from .models import Subscription, SubscriptionPayment
from .views import apply_payment_status


class SubscriptionPaymentTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(
            username="artist",
            email="artist@example.com",
            phone_number="690000000",
            password="test-password",
            role=User.ROLE_ARTIST,
        )
        self.artist = ArtistProfile.objects.create(
            user=self.user,
            brand_name="Test artist",
            mobile_money_number="690000000",
            mobile_money_provider="orange",
        )
        self.subscription = self.artist.subscription
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_renewal_adds_to_remaining_subscription_time(self):
        remaining_end = timezone.now() + timedelta(days=8)
        self.subscription.status = Subscription.STATUS_ACTIVE
        self.subscription.current_period_end = remaining_end
        self.subscription.save(update_fields=["status", "current_period_end"])
        payment = SubscriptionPayment.objects.create(
            subscription=self.subscription,
            external_reference=str(uuid.uuid4()),
            phone_number="237690000000",
            amount_xaf=2500,
            duration_months=1,
        )

        apply_payment_status(payment, {"status": "SUCCESSFUL", "transId": "legacy-renewal"})

        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.status, Subscription.STATUS_ACTIVE)
        self.assertEqual(self.subscription.current_period_end, remaining_end + timedelta(days=30))

    @override_settings(
        SUBSCRIPTION_PLANS=[{"id": 2, "duration_months": 2, "price_xaf": 250}],
        CAMPAY_BASE_URL="https://demo.campay.net/api",
        CAMPAY_USERNAME="test-user",
        CAMPAY_PASSWORD="test-password",
    )
    def test_subscription_payment_uses_campay_and_does_not_require_registration_fee(self):
        self.subscription.registration_fee_paid = False
        self.subscription.save(update_fields=["registration_fee_paid"])
        token_response = Mock()
        token_response.json.return_value = {"token": "test-token", "expires_in": 3600}
        collect_response = Mock()
        collect_response.json.return_value = {
            "reference": "campay-transaction-reference",
            "ussd_code": "*126#",
            "operator": "ORANGE",
        }

        with patch("billing.views.requests.post", side_effect=[token_response, collect_response]) as post:
            response = self.client.post(
                "/api/billing/campay/start/",
                {"plan_id": 2, "phone_number": "690000000", "method": "orange"},
                format="json",
            )

        self.assertEqual(response.status_code, 201)
        payment = SubscriptionPayment.objects.get(external_reference=response.data["external_reference"])
        self.assertEqual(payment.provider, SubscriptionPayment.PROVIDER_CAMPAY)
        self.assertEqual(payment.amount_xaf, 250)
        self.assertEqual(response.data["ussd_code"], "*126#")
        self.assertEqual(post.call_count, 2)

        token_call, collect_call = post.call_args_list
        self.assertTrue(token_call.args[0].endswith("/token/"))
        self.assertEqual(token_call.kwargs["json"], {
            "username": "test-user",
            "password": "test-password",
        })
        self.assertTrue(collect_call.args[0].endswith("/collect/"))
        self.assertEqual(collect_call.kwargs["headers"]["Authorization"], "Token test-token")
        self.assertEqual(collect_call.kwargs["json"]["amount"], 250)
        self.assertEqual(collect_call.kwargs["json"]["currency"], "XAF")
        self.assertEqual(collect_call.kwargs["json"]["from"], "237690000000")
        self.assertEqual(
            collect_call.kwargs["json"]["external_reference"],
            response.data["external_reference"],
        )
        self.assertEqual(str(uuid.UUID(response.data["external_reference"])), response.data["external_reference"])

    @override_settings(
        CAMPAY_BASE_URL="https://demo.campay.net/api",
        CAMPAY_USERNAME="test-user",
        CAMPAY_PASSWORD="test-password",
    )
    def test_retry_after_network_timeout_reuses_campay_idempotency_reference(self):
        token_response = Mock()
        token_response.json.return_value = {"token": "test-token", "expires_in": 3600}
        collect_response = Mock()
        collect_response.json.return_value = {"reference": "campay-retry-reference"}

        with patch(
            "billing.views.requests.post",
            side_effect=[token_response, requests.Timeout("request timed out"), collect_response],
        ) as post:
            first_response = self.client.post(
                "/api/billing/campay/start/",
                {"plan_id": 1, "phone_number": "690000000", "method": "orange"},
                format="json",
            )
            first_payment = SubscriptionPayment.objects.get()
            second_response = self.client.post(
                "/api/billing/campay/start/",
                {"plan_id": 1, "phone_number": "690000000", "method": "orange"},
                format="json",
            )

        self.assertEqual(first_response.status_code, 502)
        self.assertEqual(second_response.status_code, 201)
        self.assertEqual(first_payment.external_reference, second_response.data["external_reference"])
        self.assertEqual(SubscriptionPayment.objects.count(), 1)
        self.assertEqual(
            post.call_args_list[1].kwargs["json"]["external_reference"],
            post.call_args_list[2].kwargs["json"]["external_reference"],
        )

    @override_settings(
        CAMPAY_BASE_URL="",
        CAMPAY_USERNAME="",
        CAMPAY_PASSWORD="",
    )
    def test_missing_campay_configuration_fails_without_falling_back_to_demo(self):
        with patch("billing.views.requests.post") as post:
            response = self.client.post(
                "/api/billing/campay/start/",
                {"plan_id": 1, "phone_number": "690000000"},
                format="json",
            )

        self.assertEqual(response.status_code, 502)
        post.assert_not_called()
        payment = SubscriptionPayment.objects.get()
        self.assertEqual(payment.status, "PENDING")
        self.assertIsNone(payment.provider_transaction_id)

    @override_settings(
        CAMPAY_BASE_URL="https://demo.campay.net/api",
        CAMPAY_USERNAME="test-user",
        CAMPAY_PASSWORD="test-password",
    )
    def test_payment_status_verification_activates_subscription_once(self):
        external_reference = str(uuid.uuid4())
        payment = SubscriptionPayment.objects.create(
            subscription=self.subscription,
            external_reference=external_reference,
            provider=SubscriptionPayment.PROVIDER_CAMPAY,
            provider_transaction_id="campay-reference",
            phone_number="237690000000",
            amount_xaf=2000,
            duration_months=1,
        )
        token_response = Mock()
        token_response.json.return_value = {"token": "test-token", "expires_in": 3600}
        status_response = Mock()
        status_response.json.return_value = {
            "reference": "campay-reference",
            "external_reference": external_reference,
            "status": "SUCCESSFUL",
            "amount": "2000.00",
            "currency": "XAF",
        }

        with patch("billing.views.requests.post", return_value=token_response), patch(
            "billing.views.requests.get", return_value=status_response
        ) as get:
            response = self.client.get(f"/api/billing/campay/payments/{external_reference}/")
            self.subscription.refresh_from_db()
            first_period_end = self.subscription.current_period_end
            response = self.client.get(f"/api/billing/campay/payments/{external_reference}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "SUCCESSFUL")
        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.status, Subscription.STATUS_ACTIVE)
        self.assertEqual(self.subscription.current_period_end, first_period_end)
        self.assertEqual(get.call_count, 1)

    @override_settings(
        CAMPAY_BASE_URL="https://demo.campay.net/api",
        CAMPAY_USERNAME="test-user",
        CAMPAY_PASSWORD="test-password",
    )
    def test_payment_status_with_mismatched_amount_is_not_accepted(self):
        external_reference = str(uuid.uuid4())
        payment = SubscriptionPayment.objects.create(
            subscription=self.subscription,
            external_reference=external_reference,
            provider=SubscriptionPayment.PROVIDER_CAMPAY,
            provider_transaction_id="campay-reference",
            phone_number="237690000000",
            amount_xaf=2000,
            duration_months=1,
        )
        token_response = Mock()
        token_response.json.return_value = {"token": "test-token", "expires_in": 3600}
        status_response = Mock()
        status_response.json.return_value = {
            "reference": "campay-reference",
            "external_reference": external_reference,
            "status": "SUCCESSFUL",
            "amount": "1.00",
            "currency": "XAF",
        }

        with patch("billing.views.requests.post", return_value=token_response), patch(
            "billing.views.requests.get", return_value=status_response
        ):
            response = self.client.get(f"/api/billing/campay/payments/{external_reference}/")

        self.assertEqual(response.status_code, 502)
        self.subscription.refresh_from_db()
        payment.refresh_from_db()
        self.assertIsNone(self.subscription.current_period_end)
        self.assertEqual(payment.status, "PENDING")

    @override_settings(
        FAPSHI_BASE_URL="https://sandbox.fapshi.com",
        FAPSHI_APIUSER="legacy-user",
        FAPSHI_APIKEY="legacy-key",
    )
    def test_existing_fapshi_payments_can_still_be_reconciled(self):
        payment = SubscriptionPayment.objects.create(
            subscription=self.subscription,
            external_reference="legacy-fapshi-payment",
            provider_transaction_id="legacy-fapshi-transaction",
            phone_number="237690000000",
            amount_xaf=2000,
            duration_months=1,
        )
        status_response = Mock()
        status_response.json.return_value = {
            "status": "SUCCESSFUL",
            "transId": "legacy-fapshi-transaction",
        }

        with patch("billing.views.requests.get", return_value=status_response) as get:
            response = self.client.get(
                "/api/billing/fapshi/payments/legacy-fapshi-payment/"
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "SUCCESSFUL")
        self.assertEqual(get.call_args.kwargs["headers"], {
            "apiuser": "legacy-user",
            "apikey": "legacy-key",
        })

    @override_settings(
        CAMPAY_WEBHOOK_KEY="a-test-webhook-key-longer-than-thirty-two-bytes",
    )
    def test_signed_campay_webhook_activates_subscription_idempotently(self):
        external_reference = str(uuid.uuid4())
        payment = SubscriptionPayment.objects.create(
            subscription=self.subscription,
            external_reference=external_reference,
            provider=SubscriptionPayment.PROVIDER_CAMPAY,
            provider_transaction_id="campay-reference",
            phone_number="237690000000",
            amount_xaf=2000,
            duration_months=1,
        )
        signed_payload = {
            "reference": "campay-reference",
            "external_reference": external_reference,
            "status": "SUCCESSFUL",
            "amount": "2000",
            "currency": "XAF",
            "endpoint": "collect",
        }
        signature = jwt.encode(
            signed_payload,
            "a-test-webhook-key-longer-than-thirty-two-bytes",
            algorithm="HS256",
        )
        callback_data = {**signed_payload, "signature": signature}

        first_response = self.client.post(
            "/api/billing/campay/callback/",
            callback_data,
            format="json",
        )
        self.subscription.refresh_from_db()
        first_period_end = self.subscription.current_period_end
        second_response = self.client.post(
            "/api/billing/campay/callback/",
            callback_data,
            format="json",
        )

        self.assertEqual(first_response.status_code, 200)
        self.assertEqual(second_response.status_code, 200)
        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.current_period_end, first_period_end)
        payment.refresh_from_db()
        self.assertEqual(payment.status, "SUCCESSFUL")

    @override_settings(CAMPAY_WEBHOOK_KEY="a-test-webhook-key-longer-than-thirty-two-bytes")
    def test_invalid_campay_webhook_signature_is_rejected(self):
        response = self.client.post(
            "/api/billing/campay/callback/",
            {
                "reference": "not-a-payment",
                "external_reference": str(uuid.uuid4()),
                "status": "SUCCESSFUL",
                "amount": "2000",
                "currency": "XAF",
                "endpoint": "collect",
                "signature": "invalid-token",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(SubscriptionPayment.objects.count(), 0)
