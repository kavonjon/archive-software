from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('metadata', '0104_add_browse_categories_field'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='columns_export',
            name='item_permission_to_publish_online',
        ),
        migrations.RemoveField(
            model_name='item',
            name='permission_to_publish_online',
        ),
    ]
