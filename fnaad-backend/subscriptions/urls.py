from django.urls import path
from . import views


urlpatterns = [
    path("plans/", views.SubscriptionPlanListView.as_view(), name="subscription-plans"),
    path("subscribe/plan1/", views.SubscribePlan1View.as_view(), name="subscribe-plan1"),
    path("subscribe/plan2/pay-for-product/", views.PayForProductPlan2View.as_view(), name="pay-for-product-plan2"),
    path("status/", views.MySubscriptionStatusView.as_view(), name="subscription-status"),
]
