from django.contrib import admin
from django import forms
from import_export.admin import ImportExportModelAdmin
from .models import Reservation, Conge, PromoCode, TimeSlotCapacity


@admin.register(Reservation)
class ReservationAdmin(ImportExportModelAdmin):
    list_display = ['id', 'nom', 'prenom', 'email', 'reservation_date', 'status', 'total_price', 'created_at']
    list_filter = ['status', 'reservation_date', 'created_at', 'prestation_type']
    search_fields = ['nom', 'prenom', 'email', 'telephone']
    date_hierarchy = 'reservation_date'
    ordering = ['-created_at']


@admin.register(Conge)
class CongeAdmin(ImportExportModelAdmin):
    list_display = ['date', 'time_slot', 'reason', 'created_at']
    list_filter = ['date', 'created_at']
    search_fields = ['reason', 'date']
    date_hierarchy = 'date'
    ordering = ['-date', 'time_slot']


@admin.register(PromoCode)
class PromoCodeAdmin(admin.ModelAdmin):
    list_display = ['code', 'discount_display', 'is_active', 'used_count', 'max_uses_display', 'valid_from', 'valid_until', 'created_at']
    list_filter = ['is_active', 'discount_type', 'created_at', 'valid_from', 'valid_until']
    search_fields = ['code', 'description']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']
    readonly_fields = ['used_count', 'created_at', 'updated_at']

    class PromoCodeAdminForm(forms.ModelForm):
        # Use a text field so the admin UI has no numeric spinner/scroll.
        max_uses = forms.CharField(
            required=False,
            widget=forms.TextInput(attrs={'style': 'width: 140px;'}),
            help_text='Enter U for unlimited, or 0/1/2/... for limited uses.',
        )

        class Meta:
            model = PromoCode
            fields = '__all__'

        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            if self.instance and getattr(self.instance, 'pk', None) is not None:
                if getattr(self.instance, 'max_uses', None) is None or getattr(self.instance, 'max_uses', 0) < 0:
                    self.initial['max_uses'] = 'U'
                else:
                    self.initial['max_uses'] = str(self.instance.max_uses)

        def clean_max_uses(self):
            raw = self.cleaned_data.get('max_uses', '')
            value = (raw or '').strip().upper()

            # Treat empty as unlimited for convenience.
            if value == '' or value == 'U':
                return None

            try:
                parsed = int(value)
            except ValueError:
                raise forms.ValidationError('max_uses must be an integer (0,1,2,...) or "U"')

            if parsed < 0:
                raise forms.ValidationError('max_uses must be >= 0 for limited uses, or "U" for unlimited')
            return parsed

    form = PromoCodeAdminForm
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('code', 'description', 'is_active')
        }),
        ('Discount Configuration', {
            'fields': ('discount_type', 'discount_value', 'minimum_amount')
        }),
        ('Usage Limits', {
            'fields': ('max_uses', 'used_count'),
            'description': 'Enter "U" for unlimited usage, or enter a number (0+) for limited usage'
        }),
        ('Validity Period', {
            'fields': ('valid_from', 'valid_until')
        }),
        ('System Information', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def max_uses_display(self, obj):
        return 'U' if obj.max_uses is None or obj.max_uses < 0 else obj.max_uses

    max_uses_display.short_description = 'Max uses'

    def discount_display(self, obj):
        return obj.get_discount_display()
    discount_display.short_description = 'Discount'


@admin.register(TimeSlotCapacity)
class TimeSlotCapacityAdmin(admin.ModelAdmin):
    list_display = ["Max_réservations_actives_pour_un_même_créneau", "is_active", "created_at", "updated_at"]
    list_filter = ["is_active", "created_at"]
    ordering = ["-created_at"]
    search_fields = []

    fieldsets = (
        ("Limite journalière", {"fields": ("Max_réservations_actives_pour_un_même_créneau", "is_active")}),
        ("Dates", {"fields": ("created_at", "updated_at"), "classes": ("collapse",)}),
    )

    readonly_fields = ["created_at", "updated_at"]
