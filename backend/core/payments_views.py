"""
Stripe payment views. Keeps secret key on server.
"""
from decimal import Decimal

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods, require_GET
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny

from .models import Reservation


@api_view(['POST'])
@permission_classes([AllowAny])
@csrf_exempt
@require_http_methods(['POST'])
def create_payment_intent(request):
    """
    POST /api/payments/create-intent/
    Body: { "reservation_id": 123 }
    Creates a Stripe PaymentIntent for the reservation total. Returns client_secret.
    """
    try:
        import stripe
    except ImportError:
        return JsonResponse({'error': 'Stripe not installed'}, status=500)

    secret_key = getattr(settings, 'STRIPE_SECRET_KEY', None)
    if not secret_key:
        return JsonResponse({'error': 'Stripe not configured'}, status=500)

    import json
    try:
        body = json.loads(request.body) if request.body else {}
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    reservation_id = body.get('reservation_id')
    if not reservation_id:
        return JsonResponse({'error': 'reservation_id is required'}, status=400)

    try:
        reservation = Reservation.objects.get(pk=reservation_id, status='pending')
    except Reservation.DoesNotExist:
        return JsonResponse({'error': 'Reservation not found or not pending'}, status=404)

    amount = reservation.total_price
    if not amount or amount <= 0:
        return JsonResponse({'error': 'Invalid amount'}, status=400)

    # Stripe amounts are in cents (smallest currency unit)
    amount_cents = int(Decimal(str(amount)) * 100)

    stripe.api_key = secret_key
    try:
        intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency='eur',
            # Force card-only to avoid Link / other methods.
            payment_method_types=['card'],
            metadata={'reservation_id': str(reservation_id)},
        )
        return JsonResponse({
            'client_secret': intent.client_secret,
            'publishable_key': getattr(settings, 'STRIPE_PUBLISHABLE_KEY', ''),
        })
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)


@api_view(['GET'])
@permission_classes([AllowAny])
@require_GET
def get_publishable_key(request):
    """GET /api/payments/config/ - Returns Stripe publishable key for frontend."""
    key = getattr(settings, 'STRIPE_PUBLISHABLE_KEY', None)
    if not key:
        return JsonResponse({'error': 'Stripe not configured'}, status=500)
    return JsonResponse({'publishable_key': key})
