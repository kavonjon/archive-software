# Generated by Django 3.0.5 on 2023-01-22 19:12

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('metadata', '0011_auto_20230122_1417'),
    ]

    operations = [
        migrations.AddField(
            model_name='columns_export',
            name='item_descriptive_materials',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='columns_export',
            name='item_educational_materials',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='columns_export',
            name='item_music',
            field=models.BooleanField(default=True),
        ),
    ]
