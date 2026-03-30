from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import ReservationViewSet, CongeViewSet, PromoCodeViewSet
from .places_views import place_autocomplete, place_details
from .payments_views import create_payment_intent, get_publishable_key

router = DefaultRouter()
router.register(r'reservations', ReservationViewSet)
router.register(r'conges', CongeViewSet)
router.register(r'promo-codes', PromoCodeViewSet)

urlpatterns = [
    path('auth/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('', include(router.urls)),
    path('places/autocomplete/', place_autocomplete),
    path('places/details/', place_details),
    path('payments/create-intent/', create_payment_intent),
    path('payments/config/', get_publishable_key),
]
