from django.urls import path
from .views import MySubscriptionView, AdminSubscriptionsListView, AdminActivateSubscriptionView, StartSubscriptionPaymentView, StartRegistrationFeePaymentView, SubscriptionPaymentStatusView, SubscriptionPaymentConfirmView, AdminSubscriptionStatsView, SubscriptionPlansView

urlpatterns = [
    path("me/", MySubscriptionView.as_view(), name="my-subscription"),
    path("plans/", SubscriptionPlansView.as_view(), name="subscription-plans"),
    path("admin/subscriptions/", AdminSubscriptionsListView.as_view(), name="admin-subscriptions"),
    path("admin/subscriptions/<int:pk>/activate/", AdminActivateSubscriptionView.as_view(), name="admin-subscription-activate"),
    path("admin/subscriptions/stats/", AdminSubscriptionStatsView.as_view(), name="admin-subscription-stats"),
    path("fapshi/start/", StartSubscriptionPaymentView.as_view(), name="fapshi-subscription-start"),
    path("fapshi/registration-fee/start/", StartRegistrationFeePaymentView.as_view(), name="fapshi-registration-fee-start"),
    path("fapshi/payments/<str:external_reference>/", SubscriptionPaymentStatusView.as_view(), name="fapshi-subscription-status"),
    path("fapshi/confirm/", SubscriptionPaymentConfirmView.as_view(), name="fapshi-subscription-confirm"),
    # Keep aliases so already-installed app builds can finish using old URLs.
    path("campay/start/", StartSubscriptionPaymentView.as_view(), name="legacy-subscription-start"),
    path("campay/payments/<str:external_reference>/", SubscriptionPaymentStatusView.as_view(), name="legacy-subscription-status"),
    path("campay/confirm/", SubscriptionPaymentConfirmView.as_view(), name="legacy-subscription-confirm"),
]
