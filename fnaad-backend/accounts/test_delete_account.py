from unittest.mock import patch

from django.db.models.deletion import ProtectedError
from rest_framework.test import APITestCase

from accounts.models import User


class DeleteAccountViewTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="delete-me",
            email="delete-me@example.com",
            phone_number="123456789",
            password="test-password",
        )
        self.client.force_authenticate(self.user)

    def test_delete_removes_account(self):
        response = self.client.delete("/api/accounts/delete-account/")

        self.assertEqual(response.status_code, 200)
        self.assertFalse(User.objects.filter(pk=self.user.pk).exists())

    def test_protected_account_is_anonymized(self):
        with patch.object(
            self.user,
            "delete",
            side_effect=ProtectedError("Account is referenced by an order.", []),
        ):
            response = self.client.delete("/api/accounts/delete-account/")

        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)
        self.assertTrue(self.user.username.startswith("deleted_"))
        self.assertTrue(self.user.email.endswith("@deleted.invalid"))
