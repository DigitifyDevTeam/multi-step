import re
import logging
from decimal import Decimal

from rest_framework import serializers
from django.utils import timezone
from datetime import timedelta
from django.db.models import Q

from .models import Reservation, Conge, PromoCode, TimeSlotCapacity

logger = logging.getLogger(__name__)


def parse_time_slot_to_minutes(slot: str) -> int | None:
    """Parse '9h00' or '10h30' to minutes since midnight. Returns None if invalid."""
    m = re.match(r'^(\d{1,2})h(\d{2})$', slot.strip())
    if not m:
        return None
    h, mn = int(m.group(1)), int(m.group(2))
    if 0 <= h <= 23 and 0 <= mn <= 59:
        return h * 60 + mn
    return None


class ReservationSerializer(serializers.ModelSerializer):
    def _service_line_total(self, service):
        """
        Compute one supplementary service line total robustly from payload.
        Accepts price keys: price_discounted, price_original, or price.
        """
        price = (
            service.get('price_discounted')
            or service.get('price_original')
            or service.get('price')
            or 0
        )
        quantity = service.get('quantity', 1)
        return Decimal(str(price or 0)) * Decimal(int(quantity or 0))

    promo_code = serializers.SerializerMethodField()
    promo_discount_type = serializers.SerializerMethodField()
    promo_discount_value = serializers.SerializerMethodField()
    effective_discount_percentage = serializers.SerializerMethodField()

    class Meta:
        model = Reservation
        fields = [
            'id', 'prestation_type', 'selected_plan_id', 'selected_plan_title',
            'selected_plan_price', 'selected_plan_duration', 'supplementary_services',
            'reservation_date', 'time_slot', 'nom', 'prenom', 'telephone', 'email', 'adresse',
            'ville', 'code_postal', 'code_promo', 'autres_informations',
            'total_price', 'original_price', 'discount_amount', 'promo_code_applied',
            'promo_code', 'promo_discount_type', 'promo_discount_value', 'effective_discount_percentage',
            'status', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'discount_amount', 'promo_code_applied', 'original_price']

    def get_promo_code(self, obj):
        return obj.promo_code_applied.code if obj.promo_code_applied else None

    def get_promo_discount_type(self, obj):
        return obj.promo_code_applied.discount_type if obj.promo_code_applied else None

    def get_promo_discount_value(self, obj):
        return obj.promo_code_applied.discount_value if obj.promo_code_applied else None

    def get_effective_discount_percentage(self, obj):
        if not obj.original_price or obj.original_price <= 0 or not obj.discount_amount:
            return Decimal("0")
        return (obj.discount_amount / obj.original_price) * Decimal("100")

    def validate_reservation_date(self, value):
        today = timezone.localdate()
        if value < today:
            raise serializers.ValidationError(
                'La date ne peut pas être dans le passé.'
            )
        return value

    def validate(self, attrs):
        reservation_date = attrs.get('reservation_date')
        time_slot = attrs.get('time_slot')
        code_promo = attrs.get('code_promo')
        today = timezone.localdate()
        now = timezone.now()

        if reservation_date and time_slot:
            # For today: time slot must be after current time
            if reservation_date == today:
                slot_minutes = parse_time_slot_to_minutes(time_slot)
                if slot_minutes is not None:
                    current_minutes = now.hour * 60 + now.minute
                    if slot_minutes <= current_minutes:
                        raise serializers.ValidationError({
                            'time_slot': (
                                'Pour aujourd\'hui, seul un créneau après '
                                f'{now.hour}h{now.minute:02d} est possible.'
                            )
                        })

            # Check if slot is already booked
            # Slot conflict policy:
            # - confirmed reservations always block the slot
            # - pending reservations only block for a short "hold" window
            #   (prevents stale unpaid reservations from locking the schedule)
            pending_hold_minutes = 15
            pending_cutoff = now - timedelta(minutes=pending_hold_minutes)
            already_booked = Reservation.objects.filter(
                reservation_date=reservation_date,
                time_slot=time_slot,
            ).filter(
                Q(status='confirmed')
                | (Q(status='pending') & Q(created_at__gte=pending_cutoff))
            )
            
            # Debug logging
            logger.info(f"Validating slot: date={reservation_date}, slot={time_slot}, instance={self.instance}")
            
            # Exclude current instance if updating
            if self.instance and self.instance.pk:
                logger.info(f"Excluding pk={self.instance.pk} from check")
                already_booked = already_booked.exclude(pk=self.instance.pk)

            active_count_for_slot = already_booked.count()
            max_slots_per_day = TimeSlotCapacity.get_active_max_slots_per_day(default=9)

            # Per your requirement: a time slot is "complete" only after being
            # reserved `max_slots_per_day` times for the same date+time_slot.
            if max_slots_per_day <= 0 or active_count_for_slot >= max_slots_per_day:
                raise serializers.ValidationError({
                    'time_slot': f"Ce créneau est complet. (max {max_slots_per_day} réservations pour ce créneau)"
                })

        # Validate promo code if provided
        if code_promo:
            try:
                promo = PromoCode.objects.get(code__iexact=code_promo.strip())
                
                # Calculate cart total for validation
                selected_plan_price = attrs.get('selected_plan_price', 0)
                supplementary_services = attrs.get('supplementary_services', [])
                cart_total = Decimal(str(selected_plan_price or 0))
                
                for service in supplementary_services or []:
                    cart_total += self._service_line_total(service)
                
                is_valid, message = promo.is_valid(cart_total)
                if not is_valid:
                    raise serializers.ValidationError({
                        'code_promo': f"Invalid promo code: {message}"
                    })
                    
            except PromoCode.DoesNotExist:
                raise serializers.ValidationError({
                    'code_promo': 'Invalid promo code'
                })

        return attrs

    def _calculate_original_price(self, selected_plan_price, supplementary_services):
        original_price = Decimal(str(selected_plan_price or 0))
        for service in supplementary_services or []:
            original_price += self._service_line_total(service)
        return original_price

    def _apply_promo(self, code_promo, original_price):
        if not code_promo:
            return Decimal("0"), None
        try:
            promo = PromoCode.objects.get(code__iexact=code_promo.strip())
        except PromoCode.DoesNotExist:
            return Decimal("0"), None

        is_valid, _ = promo.is_valid(original_price)
        if not is_valid:
            return Decimal("0"), None

        discount_amount, _ = promo.calculate_discount(original_price)
        promo.use_promo()
        return discount_amount, promo

    def create(self, validated_data):
        code_promo = validated_data.get('code_promo')
        selected_plan_price = validated_data.get('selected_plan_price', 0)
        supplementary_services = validated_data.get('supplementary_services', [])
        original_price = self._calculate_original_price(selected_plan_price, supplementary_services)
        discount_amount, promo_code_applied = self._apply_promo(code_promo, original_price)

        validated_data['original_price'] = original_price
        validated_data['discount_amount'] = discount_amount
        validated_data['total_price'] = original_price - discount_amount
        validated_data['promo_code_applied'] = promo_code_applied
        
        return super().create(validated_data)

    def update(self, instance, validated_data):
        code_promo = validated_data.get('code_promo', instance.code_promo)
        selected_plan_price = validated_data.get('selected_plan_price', instance.selected_plan_price)
        supplementary_services = validated_data.get('supplementary_services', instance.supplementary_services)

        original_price = self._calculate_original_price(selected_plan_price, supplementary_services)
        discount_amount, promo_code_applied = self._apply_promo(code_promo, original_price)

        validated_data['original_price'] = original_price
        validated_data['discount_amount'] = discount_amount
        validated_data['total_price'] = original_price - discount_amount
        validated_data['promo_code_applied'] = promo_code_applied

        return super().update(instance, validated_data)


class CongeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Conge
        fields = ['id', 'date', 'time_slot', 'reason', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class PromoCodeSerializer(serializers.ModelSerializer):
    discount_display = serializers.ReadOnlyField()
    is_valid_display = serializers.SerializerMethodField()
    
    class Meta:
        model = PromoCode
        fields = [
            'id', 'code', 'description', 'discount_type', 'discount_value',
            'minimum_amount', 'max_uses', 'used_count', 'is_active',
            'valid_from', 'valid_until', 'discount_display', 'is_valid_display',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'used_count', 'created_at', 'updated_at']
    
    def get_is_valid_display(self, obj):
        """Check if promo code is currently valid"""
        is_valid, message = obj.is_valid()
        return {"valid": is_valid, "message": message}
    
    def validate(self, attrs):
        """Custom validation for promo code"""
        # Validate discount value based on type
        discount_type = attrs.get('discount_type', self.instance.discount_type if self.instance else 'percentage')
        discount_value = attrs.get('discount_value', self.instance.discount_value if self.instance else 0)
        
        if discount_type == 'percentage':
            if discount_value <= 0 or discount_value > 100:
                raise serializers.ValidationError({
                    'discount_value': 'Percentage discount must be between 1 and 100'
                })
        elif discount_type == 'fixed':
            if discount_value <= 0:
                raise serializers.ValidationError({
                    'discount_value': 'Fixed discount must be greater than 0'
                })
        
        # Validate dates
        valid_from = attrs.get('valid_from', self.instance.valid_from if self.instance else None)
        valid_until = attrs.get('valid_until', self.instance.valid_until if self.instance else None)
        
        if valid_until and valid_from and valid_until <= valid_from:
            raise serializers.ValidationError({
                'valid_until': 'Valid until date must be after valid from date'
            })
        
        return attrs
