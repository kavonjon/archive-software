# Generated by Django 3.2 on 2024-05-07 19:43

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('metadata', '0028_alter_item_genre'),
    ]

    operations = [
        migrations.AlterField(
            model_name='item',
            name='general_content',
            field=models.CharField(blank=True, choices=[('audio', 'Audio'), ('audio-video', 'Audio/Video'), ('publication_book', 'Publication: Book'), ('manuscript', 'Manuscript'), ('ephemera', 'Ephemera'), ('website', 'Website')], max_length=30),
        ),
    ]
