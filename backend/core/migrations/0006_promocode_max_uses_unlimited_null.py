from django.db import migrations, models


def migrate_unlimited_to_null(apps, schema_editor):
    PromoCode = apps.get_model('core', 'PromoCode')
    # Previous behavior:
    # - max_uses=0 meant unlimited
    # - after intermediate change, max_uses=-1 meant unlimited
    # New behavior:
    # - max_uses=NULL means unlimited
    PromoCode.objects.filter(max_uses__lte=0).update(max_uses=None)


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0005_promocode_max_uses_unlimited_u'),
    ]

    operations = [
        migrations.AlterField(
            model_name='promocode',
            name='max_uses',
            field=models.IntegerField(
                blank=True,
                null=True,
                default=None,
                help_text='Maximum number of uses (U = unlimited, 0 = never)',
            ),
        ),
        migrations.RunPython(migrate_unlimited_to_null, migrations.RunPython.noop),
    ]

