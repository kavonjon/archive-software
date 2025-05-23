from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver
from .models import Languoid, Item, CollaboratorRole
from .tasks import update_collection_date_ranges
from .utils import parse_standardized_date

@receiver(pre_save, sender=Item)
def update_item_date_ranges(sender, instance, **kwargs):
    """Signal to update min/max date fields based on text date fields"""
    
    # Dictionary mapping text date fields to their corresponding min/max fields
    date_field_pairs = {
        'accession_date': ('accession_date_min', 'accession_date_max'),
        'cataloged_date': ('cataloged_date_min', 'cataloged_date_max'),
        'collection_date': ('collection_date_min', 'collection_date_max'),
        'creation_date': ('creation_date_min', 'creation_date_max'),
        'deposit_date': ('deposit_date_min', 'deposit_date_max'),
    }

    # Get the existing instance from the database if it exists
    try:
        old_instance = Item.objects.get(pk=instance.pk)
    except Item.DoesNotExist:
        old_instance = None

    # Process each date field
    for text_field, (min_field, max_field) in date_field_pairs.items():
        current_value = getattr(instance, text_field)
        
        # Skip if the field hasn't changed
        if old_instance and current_value == getattr(old_instance, text_field):
            continue

        # Parse the standardized date and update min/max fields
        min_date, max_date = parse_standardized_date(current_value)
        setattr(instance, min_field, min_date)
        setattr(instance, max_field, max_date)

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
    import logging
    import time
    from django.core.cache import cache
    
    logger = logging.getLogger(__name__)
    
    # Get the collection from the instance if it exists
    collection = getattr(instance, 'collection', None)
    
    if collection:
        # Use cache to prevent multiple simultaneous updates
        cache_key = f"updating_collection_{collection.pk}"
        
        # If a task was already scheduled in the last 5 seconds, skip
        if cache.get(cache_key):
            logger.info(f"Skipping redundant collection date update for {collection.pk} (already in progress)")
            return
            
        # Set the cache to prevent duplicate tasks
        cache.set(cache_key, True, timeout=5)
        
        # Schedule the task to run asynchronously with retry handling
        try:
            from .tasks import update_collection_date_ranges
            update_collection_date_ranges.delay()
            logger.info(f"Scheduled update for collection {collection.pk}")
        except Exception as e:
            logger.error(f"Failed to queue task update_collection_date_ranges: {e}")
            # We can proceed without the Celery task, but log the error
            cache.delete(cache_key)  # Clear the cache so future attempts can happen

@receiver(post_save, sender=CollaboratorRole)
def set_citation_author_for_roles(sender, instance, created, **kwargs):
    """
    Signal handler to automatically set citation_author to True for Author or Performer roles
    when not explicitly specified.
    """
    if created and not instance.citation_author:
        if 'author' in instance.role or 'performer' in instance.role:
            instance.citation_author = True
            instance.save(update_fields=['citation_author'])