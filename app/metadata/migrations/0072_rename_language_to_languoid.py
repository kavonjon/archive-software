from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ('metadata', '0071_alter_collection_slug'),
    ]

    operations = [
        migrations.RenameModel(
            old_name='Language',
            new_name='Languoid',
        ),
    ] 