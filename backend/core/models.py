from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone
from decimal import Decimal


class Conge(models.Model):
    """
    Modèle pour marquer des jours ou créneaux comme indisponibles (congé).
    Si time_slot est nul, toute la journée est bloquée.
    """
    date = models.DateField()
    time_slot = models.CharField(max_length=10, blank=True, null=True,
                                  help_text="Laisser vide pour bloquer toute la journée")
    reason = models.CharField(max_length=200, blank=True, null=True,
                               help_text="Motif facultatif du congé (ex: 'Vacances', 'Maladie')")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Congé"
        verbose_name_plural = "Congés"
        # Prevent duplicate entries for same date/slot combination
        unique_together = ['date', 'time_slot']
        ordering = ['-date', 'time_slot']

    def __str__(self):
        if self.time_slot:
            return f"Congé {self.date} - {self.time_slot}"
        return f"Congé {self.date} (Journée entière)"


class PromoCode(models.Model):
    """
    Modèle des codes promo avec logique de validation
    """
    DISCOUNT_TYPES = [
        ('percentage', 'Pourcentage'),
        ('fixed', 'Montant fixe'),
    ]
    
    code = models.CharField(max_length=50, unique=True, help_text="Code promo unique")
    description = models.TextField(blank=True, null=True, help_text="Description du code promo")
    discount_type = models.CharField(max_length=20, choices=DISCOUNT_TYPES, default='percentage')
    discount_value = models.DecimalField(max_digits=10, decimal_places=2, help_text="Valeur de la remise (pourcentage ou montant fixe)")
    minimum_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text="Montant minimum de commande pour appliquer le code promo")
    # Le mode "illimité" est stocké en NULL.
    # L'admin accepte "U" pour représenter un usage illimité.
    max_uses = models.IntegerField(
        default=None,
        blank=True,
        null=True,
        help_text="Nombre maximal d'utilisations (U = illimité, 0 = jamais)"
    )
    used_count = models.IntegerField(default=0, help_text="Nombre de fois où ce code promo a été utilisé")
    is_active = models.BooleanField(default=True, help_text="Indique si ce code promo est actif")
    valid_from = models.DateTimeField(default=timezone.now, help_text="Date/heure de début de validité du code promo")
    valid_until = models.DateTimeField(blank=True, null=True, help_text="Date/heure de fin de validité du code promo (facultatif)")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Code promo"
        verbose_name_plural = "Codes promo"
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.code} ({self.get_discount_display()})"
    
    def clean(self):
        """Valider les contraintes du code promo"""
        errors = {}
        
        # Valider la valeur de remise
        if self.discount_type == 'percentage' and (self.discount_value <= 0 or self.discount_value > 100):
            errors['discount_value'] = 'La remise en pourcentage doit être comprise entre 1 et 100'
        elif self.discount_type == 'fixed' and self.discount_value <= 0:
            errors['discount_value'] = 'La remise fixe doit être supérieure à 0'
        
        # Valider les dates
        if self.valid_until and self.valid_from and self.valid_until <= self.valid_from:
            errors['valid_until'] = 'La date de fin de validité doit être postérieure à la date de début'

        # Valider la sémantique de max_uses :
        # - NULL signifie illimité
        # - -1 est accepté temporairement comme "illimité" pour les anciennes données
        # - sinon max_uses doit être >= 0
        if self.max_uses is not None and self.max_uses < -1:
            errors['max_uses'] = 'max_uses doit être >= -1 pour un usage limité (ou NULL/U dans l’admin)'
        
        if errors:
            raise ValidationError(errors)
    
    def is_valid(self, cart_total=0):
        """Vérifier si le code promo est valide et applicable"""
        cart_total = Decimal(str(cart_total or 0))

        if not self.is_active:
            return False, "Le code promo est inactif"
        
        now = timezone.now()
        if now < self.valid_from:
            return False, "Le code promo n'est pas encore valide"
        
        if self.valid_until and now > self.valid_until:
            return False, "Le code promo a expiré"
        
        # Les valeurs négatives sont traitées comme illimitées jusqu'à la migration de nettoyage.
        if self.max_uses is not None and self.max_uses >= 0 and self.used_count >= self.max_uses:
            return False, "Le code promo a atteint son nombre maximal d'utilisations"
        
        if cart_total < self.minimum_amount:
            return False, f"Un montant minimum de {self.minimum_amount} € est requis"
        
        return True, "Valide"
    
    def calculate_discount(self, cart_total):
        """Calculer le montant de la remise selon le total du panier"""
        cart_total = Decimal(str(cart_total or 0))
        is_valid, message = self.is_valid(cart_total)
        if not is_valid:
            return Decimal("0"), message
        
        if self.discount_type == 'percentage':
            discount = cart_total * (self.discount_value / Decimal("100"))
        else:  # fixed
            discount = min(self.discount_value, cart_total)
        
        return discount, "Remise appliquée"
    
    def use_promo(self):
        """Incrémenter le compteur d'utilisation du code promo"""
        self.used_count += 1
        self.save(update_fields=['used_count'])
    
    def get_discount_display(self):
        """Affichage lisible de la remise"""
        if self.discount_type == 'percentage':
            return f"{self.discount_value}% de remise"
        else:
            return f"{self.discount_value} € de remise"


class Reservation(models.Model):
    # Step 1: Prestation type and plan
    prestation_type = models.CharField(max_length=50)
    selected_plan_id = models.CharField(max_length=50)
    selected_plan_title = models.CharField(max_length=100)
    selected_plan_price = models.DecimalField(max_digits=10, decimal_places=2)
    selected_plan_duration = models.CharField(max_length=20)
    
    # Step 2: Supplementary services (embedded JSON)
    supplementary_services = models.JSONField(
        default=list,
        blank=True,
        help_text="Liste des prestations supplémentaires au format JSON"
    )
    
    # Step 3: Date and time
    reservation_date = models.DateField()
    time_slot = models.CharField(max_length=10)
    
    # Step 4: Personal information
    nom = models.CharField(max_length=100)
    prenom = models.CharField(max_length=100)
    telephone = models.CharField(max_length=20)
    email = models.EmailField()
    adresse = models.TextField()
    ville = models.CharField(max_length=100)
    code_postal = models.CharField(max_length=10)
    code_promo = models.CharField(max_length=50, blank=True, null=True)
    autres_informations = models.TextField(blank=True, null=True)
    
    # Pricing
    total_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text="Montant de remise appliqué")
    promo_code_applied = models.ForeignKey(PromoCode, on_delete=models.SET_NULL, null=True, blank=True, related_name='reservations')
    original_price = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text="Prix initial avant remise")
    
    # Status
    STATUS_CHOICES = [
        ('pending', 'En attente'),
        ('confirmed', 'Confirmée'),
        ('cancelled', 'Annulée'),
        ('completed', 'Terminée'),
    ]
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Réservation {self.id} - {self.nom} {self.prenom} ({self.reservation_date})"


class TimeSlotCapacity(models.Model):
    """
    Nombre maximal de réservations actives autorisées pour un même créneau
    (`reservation_date` + `time_slot`) par jour.

    Une fois ce maximum atteint pour un créneau donné, ce créneau est considéré
    "complet" côté API (les autres créneaux restent disponibles).
    """

    # Keep this default aligned with the frontend/backend TIME_SLOTS lists.
    # If TIME_SLOTS changes, update this default accordingly.
    Max_réservations_actives_pour_un_même_créneau = models.PositiveIntegerField(
        default=9,
    )
    is_active = models.BooleanField(default=True, help_text="Seul l'élément actif est utilisé.")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Capacité de créneaux"
        verbose_name_plural = "Capacités de créneaux"
        ordering = ["-created_at", "-id"]

    @classmethod
    def get_active_max_slots_per_day(cls, default: int = 9) -> int:
        obj = cls.objects.filter(is_active=True).order_by("-created_at", "-id").first()
        if obj is None:
            return default
        return int(obj.Max_réservations_actives_pour_un_même_créneau)

    def clean(self):
        # PositiveIntegerField already enforces >= 0.
        if self.Max_réservations_actives_pour_un_même_créneau is None:
            self.Max_réservations_actives_pour_un_même_créneau = 0

    def __str__(self):
        return f"{self.Max_réservations_actives_pour_un_même_créneau} créneaux/jour ({'actif' if self.is_active else 'inactif'})"

