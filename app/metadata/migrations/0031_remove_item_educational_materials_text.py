# Generated by Django 3.2 on 2024-05-08 09:28

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('metadata', '0030_alter_item_general_content'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='item',
            name='educational_materials_text',
        ),
    ]