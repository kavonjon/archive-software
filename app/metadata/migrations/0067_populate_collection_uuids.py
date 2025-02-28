from django.db import migrations
import uuid

def gen_uuid(apps, schema_editor):
    Collection = apps.get_model('metadata', 'Collection')
    for collection in Collection.objects.all():
        while True:
            new_uuid = uuid.uuid4()
            if not Collection.objects.filter(uuid=new_uuid).exists():
                collection.uuid = new_uuid
                collection.save()
                break

class Migration(migrations.Migration):
    dependencies = [
        ('metadata', '0066_collection_uuid'),
    ]

    operations = [
        migrations.RunPython(gen_uuid, reverse_code=migrations.RunPython.noop),
    ]