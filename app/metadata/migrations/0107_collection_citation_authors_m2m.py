from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('metadata', '0106_alter_item_browse_categories'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='collection',
            name='citation_authors',
        ),
        migrations.AddField(
            model_name='collection',
            name='citation_authors',
            field=models.ManyToManyField(
                blank=True,
                related_name='collection_citation_authors',
                to='metadata.collaborator',
                verbose_name='Citation Authors',
            ),
        ),
    ]
