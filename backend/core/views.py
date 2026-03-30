from datetime import date
from datetime import timedelta
from decimal import Decimal

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Q, Count

from .models import Reservation, Conge, PromoCode, TimeSlotCapacity
from .serializers import ReservationSerializer, CongeSerializer, PromoCodeSerializer
from .email_sender import notify_admin_reservation_confirmed


# Time slots must match frontend TIME_SLOTS (Step03DateHeure.tsx)
TIME_SLOTS = [
    "9h00", "10h30", "12h00", "13h30",
    "15h00", "16h30", "18h00", "19h30",
    "21h00",
]


class ReservationViewSet(viewsets.ModelViewSet):
    """
    CRUD API endpoint for reservations.
    Provides list, create, retrieve, update, and delete operations.
    """
    queryset = Reservation.objects.all()
    serializer_class = ReservationSerializer

    def get_permissions(self):
        # Public endpoints needed by customer booking flow.
        # - create: create reservation
        # - available_slots: check calendar availability
        # - confirm: finalize booking after successful Stripe confirmation on frontend
        if self.action in {'create', 'available_slots', 'confirm'}:
            return [AllowAny()]
        # Protected: everything else.
        return [IsAuthenticated()]
    
    def get_queryset(self):
        queryset = Reservation.objects.all()
        
        # Optional filtering by status
        status_param = self.request.query_params.get('status', None)
        if status_param:
            queryset = queryset.filter(status=status_param)
        
        # Optional filtering by email
        email_param = self.request.query_params.get('email', None)
        if email_param:
            queryset = queryset.filter(email__icontains=email_param)
        
        # Optional filtering by date range
        date_from = self.request.query_params.get('date_from', None)
        date_to = self.request.query_params.get('date_to', None)
        if date_from:
            queryset = queryset.filter(reservation_date__gte=date_from)
        if date_to:
            queryset = queryset.filter(reservation_date__lte=date_to)
        
        return queryset

    def create(self, request, *args, **kwargs):
        """
        Idempotent create for checkout retries:
        if a very recent pending reservation already exists for the same
        customer/date/slot, return it instead of failing with slot conflict.
        """
        payload = request.data
        reservation_date = payload.get('reservation_date')
        time_slot = payload.get('time_slot')
        email = payload.get('email')
        telephone = payload.get('telephone')

        if reservation_date and time_slot and email and telephone:
            hold_cutoff = timezone.now() - timedelta(minutes=15)
            existing = (
                Reservation.objects.filter(
                    reservation_date=reservation_date,
                    time_slot=time_slot,
                    email__iexact=email.strip(),
                    telephone=telephone.strip(),
                    status='pending',
                    created_at__gte=hold_cutoff,
                )
                .order_by('-created_at')
                .first()
            )
            if existing:
                serializer = self.get_serializer(existing)
                return Response(serializer.data, status=status.HTTP_200_OK)

        return super().create(request, *args, **kwargs)
    
    def perform_create(self, serializer):
        """Prices and promo are handled in serializer.create()."""
        serializer.save()
    
    def perform_update(self, serializer):
        """Prices and promo are handled in serializer.update()."""
        serializer.save()
    
    @action(detail=False, methods=['get'], url_path='available-slots')
    def available_slots(self, request):
        """
        Returns booked time slots for a given date.
        Query param: date (YYYY-MM-DD)
        Response: { "booked_slots": ["9h00", "12h00"], "date": "2025-03-24" }
        """
        date_str = request.query_params.get('date')
        if not date_str:
            return Response(
                {'error': 'Query param "date" (YYYY-MM-DD) is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            target_date = date.fromisoformat(date_str)
        except ValueError:
            return Response(
                {'error': 'Invalid date format. Use YYYY-MM-DD'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        today = timezone.localdate()
        if target_date < today:
            return Response(
                {'error': 'Cannot query availability for past dates'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Active reservations:
        # - confirmed always block the slot
        # - pending blocks only within a short "hold" window
        pending_hold_minutes = 15
        pending_cutoff = timezone.now() - timedelta(minutes=pending_hold_minutes)

        reserved_qs = (
            Reservation.objects.filter(reservation_date=target_date)
            .filter(
                Q(status="confirmed")
                | (Q(status="pending") & Q(created_at__gte=pending_cutoff))
            )
        )

        # Max capacity is per time-slot (same date+time_slot).
        max_slots_per_day = TimeSlotCapacity.get_active_max_slots_per_day(default=len(TIME_SLOTS))
        if max_slots_per_day <= 0:
            booked_slots = TIME_SLOTS.copy()
        else:
            # Count active reservations per slot and mark slots as complete
            # once they reach the configured capacity.
            slot_counts = (
                reserved_qs.values("time_slot")
                .annotate(active_count=Count("id"))
            )
            booked_slots = [
                row["time_slot"]
                for row in slot_counts
                if row.get("active_count", 0) >= max_slots_per_day
            ]
        
        # Get congé (blocked) slots for this date
        conge_slots = []
        conge_full_day = False
        conges = Conge.objects.filter(date=target_date)
        
        for conge in conges:
            if conge.time_slot:
                conge_slots.append(conge.time_slot)
            else:
                # Full day is blocked
                conge_full_day = True
                conge_slots = TIME_SLOTS.copy()
                break
        
        return Response({
            'date': date_str,
            'booked_slots': booked_slots,
            'conge_slots': conge_slots,
            'conge_full_day': conge_full_day,
        })

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """Confirm a pending reservation"""
        reservation = self.get_object()
        if reservation.status == 'pending':
            reservation.status = 'confirmed'
            reservation.save()
            try:
                notify_admin_reservation_confirmed(reservation)
            except Exception:
                # Never block confirmation if email fails (dev / config issue).
                pass
            return Response({'status': 'Reservation confirmed'})
        return Response(
            {'error': f'Cannot confirm reservation with status: {reservation.status}'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a reservation"""
        reservation = self.get_object()
        if reservation.status in ['pending', 'confirmed']:
            reservation.status = 'cancelled'
            reservation.save()
            return Response({'status': 'Reservation cancelled'})
        return Response(
            {'error': f'Cannot cancel reservation with status: {reservation.status}'},
            status=status.HTTP_400_BAD_REQUEST
        )


class CongeViewSet(viewsets.ModelViewSet):
    """
    API endpoint for managing congé (blocked days/time slots).
    This is only visible in the admin panel.
    """
    queryset = Conge.objects.all()
    serializer_class = CongeSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = Conge.objects.all()
        
        # Optional filtering by date range
        date_from = self.request.query_params.get('date_from', None)
        date_to = self.request.query_params.get('date_to', None)
        if date_from:
            queryset = queryset.filter(date__gte=date_from)
        if date_to:
            queryset = queryset.filter(date__lte=date_to)
        
        return queryset


class PromoCodeViewSet(viewsets.ModelViewSet):
    """
    CRUD API endpoint for promo codes.
    Provides list, create, retrieve, update, and delete operations.
    """
    queryset = PromoCode.objects.all()
    serializer_class = PromoCodeSerializer

    def get_permissions(self):
        # Public for checkout promo validation only.
        if self.action == 'validate':
            return [AllowAny()]
        # Protected for promo CRUD and usage operations.
        return [IsAuthenticated()]
    
    def get_queryset(self):
        queryset = PromoCode.objects.all()
        
        # Optional filtering by active status
        is_active = self.request.query_params.get('is_active', None)
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        # Optional filtering by discount type
        discount_type = self.request.query_params.get('discount_type', None)
        if discount_type:
            queryset = queryset.filter(discount_type=discount_type)
        
        return queryset
    
    @action(detail=False, methods=['post'])
    def validate(self, request):
        """Validate a promo code against a cart total"""
        code = request.data.get('code', '').strip()
        cart_total = Decimal(request.data.get('cart_total', '0'))
        
        if not code:
            return Response(
                {'error': 'Promo code is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Case-insensitive lookup so users can enter promo codes
            # in lowercase/uppercase without failing validation.
            promo = PromoCode.objects.get(code__iexact=code)
        except PromoCode.DoesNotExist:
            return Response(
                {'valid': False, 'message': 'Invalid promo code'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        is_valid, message = promo.is_valid(cart_total)
        discount_amount = 0
        
        if is_valid:
            discount_amount, _ = promo.calculate_discount(cart_total)
        
        return Response({
            'valid': is_valid,
            'message': message,
            'discount_amount': discount_amount,
            'discount_type': promo.discount_type,
            'discount_value': promo.discount_value,
            'promo_id': promo.id
        })
    
    @action(detail=True, methods=['post'])
    def use(self, request, pk=None):
        """Mark a promo code as used"""
        promo = self.get_object()
        
        is_valid, message = promo.is_valid()
        if not is_valid:
            return Response(
                {'error': message}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        promo.use_promo()
        serializer = self.get_serializer(promo)
        return Response(serializer.data)

