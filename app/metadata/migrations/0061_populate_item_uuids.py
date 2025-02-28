from django.db import migrations
import uuid

def gen_uuid(apps, schema_editor):
    Item = apps.get_model('metadata', 'Item')
    for item in Item.objects.all():
        while True:
            new_uuid = uuid.uuid4()
            if not Item.objects.filter(uuid=new_uuid).exists():
                item.uuid = new_uuid
                item.save()
                break

class Migration(migrations.Migration):
    dependencies = [
        ('metadata', '0060_item_uuid'),
    ]

    operations = [
        migrations.RunPython(gen_uuid, reverse_code=migrations.RunPython.noop),
    ]