# Generated by Django 3.0.5 on 2023-03-08 14:27

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('metadata', '0014_auto_20230308_1424'),
    ]

    operations = [
        migrations.RenameField(
            model_name='columns_export',
            old_name='item_music_text',
            new_name='item_music',
        ),
    ]
