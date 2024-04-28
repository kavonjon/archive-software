from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Language

@receiver(post_save, sender=Language)
def post_save_language(sender, instance, **kwargs):
    updates = {}
    if not instance.family_abbrev:
        updates['family_abbrev'] = instance.family
    if not instance.pri_subgroup_abbrev:
        updates['pri_subgroup_abbrev'] = instance.pri_subgroup
    if not instance.sec_subgroup_abbrev:
        updates['sec_subgroup_abbrev'] = instance.sec_subgroup
    if updates:
        Language.objects.filter(pk=instance.pk).update(**updates)