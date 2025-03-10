# Generated by Django 3.2 on 2024-09-26 10:06

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('metadata', '0054_alter_language_dialects_languoids'),
    ]

    operations = [
        migrations.AddField(
            model_name='language',
            name='family_languoid',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='descendant_languoids_of_family', to='metadata.language'),
        ),
        migrations.AddField(
            model_name='language',
            name='language_languoid',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='child_dialects_languoids', to='metadata.language'),
        ),
        migrations.AddField(
            model_name='language',
            name='parent_languoid',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='child_languoids', to='metadata.language'),
        ),
        migrations.AddField(
            model_name='language',
            name='pri_subgroup_languoid',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='descendant_languoids_of_primary_subgroup', to='metadata.language'),
        ),
        migrations.AddField(
            model_name='language',
            name='sec_subgroup_languoid',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='descendant_languoids_of_secondary_subgroup', to='metadata.language'),
        ),
    ]
