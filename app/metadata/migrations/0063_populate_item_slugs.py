import base58
from django.db import migrations

def generate_slugs(apps, schema_editor):
    Item = apps.get_model('metadata', 'Item')
    for item in Item.objects.all():
        if not item.slug:
            encoded = base58.b58encode(item.uuid.bytes).decode()[:10]
            item.slug = f"{encoded[:5]}-{encoded[5:10]}"  # Insert dash in the middle
            item.save()

class Migration(migrations.Migration):
    dependencies = [
        ('metadata', '0062_item_slug'),
    ]

    operations = [
        migrations.RunPython(generate_slugs, reverse_code=migrations.RunPython.noop),
    ]