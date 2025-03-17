from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from .models import Languoid, Item
from .tasks import update_collection_date_ranges

@receiver(post_save, sender=Languoid)
def post_save_languoid(sender, instance, **kwargs):
    updates = {}
    if not instance.family_abbrev:
        updates['family_abbrev'] = instance.family
    if not instance.pri_subgroup_abbrev:
        updates['pri_subgroup_abbrev'] = instance.pri_subgroup
    if not instance.sec_subgroup_abbrev:
        updates['sec_subgroup_abbrev'] = instance.sec_subgroup
    if updates:
        Languoid.objects.filter(pk=instance.pk).update(**updates)

@receiver([post_save, post_delete], sender=Item)
def update_collection_dates_on_item_change(sender, instance, **kwargs):
    """
    When an item is saved or deleted, update the date ranges for its collection
    """
    # Get the collection from the instance if it exists
    collection = getattr(instance, 'collection', None)
    
    if collection:
        # Schedule the task to run asynchronously
        update_collection_date_ranges.delay()