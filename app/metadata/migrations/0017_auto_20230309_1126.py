# Generated by Django 3.0.5 on 2023-03-09 11:26

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('metadata', '0016_auto_20230308_1428'),
    ]

    operations = [
        migrations.RenameField(
            model_name='item',
            old_name='descriptive_materials',
            new_name='descriptive_materials_text',
        ),
    ]
