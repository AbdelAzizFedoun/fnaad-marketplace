from django.urls import path
from .views import (
    AdminActivateSubscriptionView,
    AdminSubscriptionStatsView,
    AdminSubscriptionsListView,
    CamPayWebhookView,
    MySubscriptionView,
    StartSubscriptionPaymentView,
    SubscriptionPaymentConfirmView,
    SubscriptionPaymentStatusView,
    SubscriptionPlansView,
)

urlpatterns = [
    path("me/", MySubscriptionView.as_view(), name="my-subscription"),
    path("plans/", SubscriptionPlansView.as_view(), name="subscription-plans"),
    path("admin/subscriptions/", AdminSubscriptionsListView.as_view(), name="admin-subscriptions"),
    path("admin/subscriptions/<int:pk>/activate/", AdminActivateSubscriptionView.as_view(), name="admin-subscription-activate"),
    path("admin/subscriptions/stats/", AdminSubscriptionStatsView.as_view(), name="admin-subscription-stats"),
    path("campay/start/", StartSubscriptionPaymentView.as_view(), name="campay-subscription-start"),
    path("campay/payments/<str:external_reference>/", SubscriptionPaymentStatusView.as_view(), name="campay-subscription-status"),
    path("campay/confirm/", SubscriptionPaymentConfirmView.as_view(), name="campay-subscription-confirm"),
    path("campay/callback/", CamPayWebhookView.as_view(), name="campay-webhook"),
    # Keep the old subscription paths available for installed app builds.
    path("fapshi/start/", StartSubscriptionPaymentView.as_view(), name="legacy-fapshi-subscription-start"),
    path("fapshi/payments/<str:external_reference>/", SubscriptionPaymentStatusView.as_view(), name="legacy-fapshi-subscription-status"),
    path("fapshi/confirm/", SubscriptionPaymentConfirmView.as_view(), name="legacy-fapshi-subscription-confirm"),
]
