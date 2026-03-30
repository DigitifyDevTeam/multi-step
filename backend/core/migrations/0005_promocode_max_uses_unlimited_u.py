from django.db import migrations, models


def convert_unlimited_zero_to_minus_one(apps, schema_editor):
    """
    Previous behavior: max_uses=0 meant unlimited.
    New behavior: unlimited is stored as max_uses=-1 and admin uses "U".
    """
    PromoCode = apps.get_model('core', 'PromoCode')
    PromoCode.objects.filter(max_uses=0).update(max_uses=-1)


def revert_minus_one_to_unlimited_zero(apps, schema_editor):
    PromoCode = apps.get_model('core', 'PromoCode')
    PromoCode.objects.filter(max_uses=-1).update(max_uses=0)


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0004_promocode_reservation_discount_amount_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='promocode',
            name='max_uses',
            field=models.IntegerField(
                default=-1,
                help_text='Maximum number of uses (U/-1 = unlimited, 0 = never)',
            ),
        ),
        migrations.RunPython(
            convert_unlimited_zero_to_minus_one,
            revert_minus_one_to_unlimited_zero,
        ),
    ]

