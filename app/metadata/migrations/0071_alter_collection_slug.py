# Generated by Django 3.2 on 2025-02-27 06:02

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('metadata', '0070_alter_collection_uuid'),
    ]

    operations = [
        migrations.AlterField(
            model_name='collection',
            name='slug',
            field=models.CharField(blank=True, max_length=20, unique=True),
        ),
    ]
