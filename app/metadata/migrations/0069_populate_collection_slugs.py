import base58
from django.db import migrations

def generate_slugs(apps, schema_editor):
    Collection = apps.get_model('metadata', 'Collection')
    for collection in Collection.objects.all():
        if not collection.slug:
            encoded = base58.b58encode(collection.uuid.bytes).decode()[:10]
            collection.slug = f"{encoded[:5]}-{encoded[5:10]}"  # Insert dash in the middle
            collection.save()

class Migration(migrations.Migration):
    dependencies = [
        ('metadata', '0068_collection_slug'),
    ]

    operations = [
        migrations.RunPython(generate_slugs, reverse_code=migrations.RunPython.noop),
    ]