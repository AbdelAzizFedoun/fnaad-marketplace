from django.db import models
from django.utils import timezone
from datetime import timedelta

from accounts.models import ArtistProfile


class SubscriptionPlan(models.Model):
    PLAN_TYPE_PLAN1 = "plan1"  # Subscription (flat/monthly tiers)
    PLAN_TYPE_PLAN2 = "plan2"  # Pay per product

    PLAN_TYPE_CHOICES = [
        (PLAN_TYPE_PLAN1, "Plan 1 - Subscription"),
        (PLAN_TYPE_PLAN2, "Plan 2 - Pay per product"),
    ]

    name = models.CharField(max_length=100)
    plan_type = models.CharField(max_length=20, choices=PLAN_TYPE_CHOICES)
    description = models.TextField(blank=True)
    # For plan1: price per billing cycle (XAF)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    # For plan1: billing cycle in days (30, 60, 90)
    billing_cycle_days = models.PositiveIntegerField(default=30)
    # For plan2: price per product (XAF)
    price_per_product = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    # For plan2: visibility duration in days per paid product (default 30)
    product_visibility_days = models.PositiveIntegerField(default=30)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["plan_type", "billing_cycle_days", "price"]

    def __str__(self):
        if self.plan_type == self.PLAN_TYPE_PLAN1:
            return f"{self.name} ({self.billing_cycle_days} days - {self.price} XAF)"
        return f"{self.name} ({self.price_per_product} XAF/product - {self.product_visibility_days} days)"


class Subscription(models.Model):
    STATUS_ACTIVE = "active"
    STATUS_PAST_DUE = "past_due"
    STATUS_CANCELLED = "cancelled"
    STATUS_EXPIRED = "expired"

    STATUS_CHOICES = [
        (STATUS_ACTIVE, "Active"),
        (STATUS_PAST_DUE, "Past Due"),
        (STATUS_CANCELLED, "Cancelled"),
        (STATUS_EXPIRED, "Expired"),
    ]

    artist = models.ForeignKey(ArtistProfile, on_delete=models.CASCADE, related_name="subscriptions")
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.PROTECT, related_name="subscriptions")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    transaction_reference = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    auto_renew = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-ends_at"]

    def is_active(self):
        now = timezone.now()
        return self.status == self.STATUS_ACTIVE and self.starts_at <= now <= self.ends_at

    def __str__(self):
        return f"{self.artist.brand_name} - {self.plan.name} ({self.status})"


class ProductSubscriptionPayment(models.Model):
    PAYMENT_STATUS_PENDING = "pending"
    PAYMENT_STATUS_PAID = "paid"
    PAYMENT_STATUS_FAILED = "failed"
    PAYMENT_STATUS_REFUNDED = "refunded"

    PAYMENT_STATUS_CHOICES = [
        (PAYMENT_STATUS_PENDING, "Pending"),
        (PAYMENT_STATUS_PAID, "Paid"),
        (PAYMENT_STATUS_FAILED, "Failed"),
        (PAYMENT_STATUS_REFUNDED, "Refunded"),
    ]

    artist = models.ForeignKey(ArtistProfile, on_delete=models.CASCADE, related_name="product_payments")
    product = models.ForeignKey("catalog.Product", on_delete=models.CASCADE, related_name="product_payments")
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.PROTECT, related_name="product_payments")
    status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default=PAYMENT_STATUS_PENDING)
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    visibility_ends_at = models.DateTimeField(null=True, blank=True)
    transaction_reference = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.product.title} - {self.amount} XAF ({self.status})"
