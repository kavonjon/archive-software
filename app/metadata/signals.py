from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver
from .models import Languoid, Item, CollaboratorRole
from .tasks import update_collection_date_ranges
from .utils import parse_standardized_date
import logging

logger = logging.getLogger(__name__)

def standardize_date_format(date_str):
    """
    Standardize date string using the same logic as the existing management command.
    Converts American MM/DD/YYYY formats to YYYY/MM/DD formats.
    Preserves already standardized YYYY-first formats.
    """
    if not date_str:
        return date_str

    import re
    
    # YYYY format (preserve as is)
    year_only = re.match(r'^(\d{4})$', date_str)
    if year_only:
        return date_str

    # YYYY-YYYY format (preserve as is) 
    year_range = re.match(r'^(\d{4})-(\d{4})$', date_str)
    if year_range:
        return date_str

    # YYYY/MM-YYYY/MM format (already standardized - preserve as is)
    # This matches both zero-padded (YYYY/MM) and non-padded (YYYY/M) formats
    standardized_month_year_range = re.match(r'^(\d{4})/(\d{1,2})-(\d{4})/(\d{1,2})$', date_str)
    if standardized_month_year_range:
        return date_str

    # YYYY/MM/DD-YYYY/MM/DD format (already standardized - preserve as is)
    # This matches both zero-padded and non-padded formats
    standardized_full_date_range = re.match(r'^(\d{4})/(\d{1,2})/(\d{1,2})-(\d{4})/(\d{1,2})/(\d{1,2})$', date_str)
    if standardized_full_date_range:
        return date_str

    # YYYY/MM format (already standardized - preserve as is)
    # This matches both zero-padded and non-padded formats
    standardized_month_year = re.match(r'^(\d{4})/(\d{1,2})$', date_str)
    if standardized_month_year:
        return date_str

    # YYYY/MM/DD format (already standardized - preserve as is)
    # This matches both zero-padded and non-padded formats
    standardized_full_date = re.match(r'^(\d{4})/(\d{1,2})/(\d{1,2})$', date_str)
    if standardized_full_date:
        return date_str

    # MM/YYYY-MM/YYYY format → YYYY/MM-YYYY/MM
    month_year_range = re.match(r'^(\d{1,2})/(\d{4})-(\d{1,2})/(\d{4})$', date_str)
    if month_year_range:
        month1, year1, month2, year2 = month_year_range.groups()
        return f"{year1}/{month1.zfill(2)}-{year2}/{month2.zfill(2)}"

    # MM/DD/YYYY-MM/DD/YYYY format → YYYY/MM/DD-YYYY/MM/DD  
    full_date_range = re.match(r'^(\d{1,2})/(\d{1,2})/(\d{4})-(\d{1,2})/(\d{1,2})/(\d{4})$', date_str)
    if full_date_range:
        month1, day1, year1, month2, day2, year2 = full_date_range.groups()
        return f"{year1}/{month1.zfill(2)}/{day1.zfill(2)}-{year2}/{month2.zfill(2)}/{day2.zfill(2)}"

    # MM/DD/YYYY format → YYYY/MM/DD
    full_date = re.match(r'^(\d{1,2})/(\d{1,2})/(\d{4})$', date_str)
    if full_date:
        month, day, year = full_date.groups()
        return f"{year}/{month.zfill(2)}/{day.zfill(2)}"

    # MM/YYYY format → YYYY/MM
    month_year = re.match(r'^(\d{1,2})/(\d{4})$', date_str)
    if month_year:
        month, year = month_year.groups()
        return f"{year}/{month.zfill(2)}"

    # If no conversion patterns match, return original
    return date_str

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
            from django.conf import settings
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


# ============================================================================
# LANGUOID HIERARCHY SIGNALS
# ============================================================================

def derive_level_nal(languoid):
    """
    Derive level_nal from level_glottolog and parent_languoid.
    
    Rules:
    - If level_glottolog is 'dialect' → 'dialect'
    - If level_glottolog is 'language' → 'language'
    - If level_glottolog is 'family':
        - No parent → 'family' (top-level family)
        - Parent is 'family' → 'subfamily' (primary subfamily)
        - Parent is 'subfamily' → 'subsubfamily' (secondary subfamily)
        - Otherwise → 'family' (fallback)
    """
    if languoid.level_glottolog == 'dialect':
        return 'dialect'
    
    if languoid.level_glottolog == 'language':
        return 'language'
    
    if languoid.level_glottolog == 'family':
        if not languoid.parent_languoid:
            return 'family'  # Top-level family
        
        parent = languoid.parent_languoid
        if parent.level_nal == 'family':
            return 'subfamily'  # Primary subfamily
        elif parent.level_nal == 'subfamily':
            return 'subsubfamily'  # Secondary subfamily
        else:
            return 'family'  # Fallback
    
    return 'family'  # Default fallback


def derive_hierarchy_fks(languoid):
    """
    Derive family_languoid, pri_subgroup_languoid, sec_subgroup_languoid
    from parent_languoid chain.
    
    Logic based on parent's level_nal:
    - Parent is 'family' → family_languoid = parent
    - Parent is 'subfamily' → pri_subgroup = parent, family = parent.family
    - Parent is 'subsubfamily' → sec_subgroup = parent, pri_subgroup = parent.pri_subgroup, family = parent.family
    - Parent is 'language' → inherit all three from parent (for dialects)
    - Parent is 'dialect' → should not happen (could add validation)
    """
    # Clear all hierarchy FKs first
    languoid.family_languoid = None
    languoid.pri_subgroup_languoid = None
    languoid.sec_subgroup_languoid = None
    
    if not languoid.parent_languoid:
        return  # No parent, no hierarchy to derive
    
    parent = languoid.parent_languoid
    parent_level = parent.level_nal
    
    if parent_level == 'family':
        # Parent is a top-level family
        languoid.family_languoid = parent
    
    elif parent_level == 'subfamily':
        # Parent is a primary subfamily
        languoid.pri_subgroup_languoid = parent
        languoid.family_languoid = parent.family_languoid  # Inherit from parent
    
    elif parent_level == 'subsubfamily':
        # Parent is a secondary subfamily
        languoid.sec_subgroup_languoid = parent
        languoid.pri_subgroup_languoid = parent.pri_subgroup_languoid  # Inherit
        languoid.family_languoid = parent.family_languoid  # Inherit
    
    elif parent_level == 'language':
        # This languoid is a dialect - inherit all hierarchy from parent language
        languoid.family_languoid = parent.family_languoid
        languoid.pri_subgroup_languoid = parent.pri_subgroup_languoid
        languoid.sec_subgroup_languoid = parent.sec_subgroup_languoid
    
    elif parent_level == 'dialect':
        # Dialects cannot be parents - log warning
        logger.warning(f"Invalid parent: dialect '{parent.name}' cannot be parent of '{languoid.name}'")


def clear_language_specific_fields(instance, old_instance):
    """
    Clear language-specific fields when converting away from language level.
    Children will be orphaned in the async task.
    """
    logger.warning(
        f"Level change detected for '{instance.name}' (ID: {instance.pk}): "
        f"language → {instance.level_glottolog}"
    )
    
    # Clear language-specific fields IMMEDIATELY
    instance.region = ''
    instance.longitude = None
    instance.latitude = None
    instance.tribes = ''
    instance.notes = ''
    
    logger.info(f"Cleared language-specific fields for '{instance.name}'")
    
    # Flag for async task to handle children
    instance._needs_dialect_orphaning = True


@receiver(pre_save, sender=Languoid)
def compute_languoid_derived_fields(sender, instance, **kwargs):
    """
    Compute derived fields before save.
    
    This handles:
    1. Detecting level_glottolog changes from 'language' and clearing fields
    2. Deriving level_nal from level_glottolog and parent
    3. Defaulting name_abbrev to name if empty
    4. Deriving family/subgroup FKs from parent_languoid chain
    """
    # Get old instance to detect changes
    old_instance = None
    if instance.pk:
        try:
            old_instance = Languoid.objects.get(pk=instance.pk)
        except Languoid.DoesNotExist:
            pass
    
    # Track old parent for descendents M2M update
    if old_instance and old_instance.parent_languoid != instance.parent_languoid:
        # Store old parent ID for post-save task to update old ancestor chain
        instance._old_parent_id = old_instance.parent_languoid.id if old_instance.parent_languoid else None
    
    # CRITICAL: Handle level_glottolog change FROM language TO other
    if old_instance and old_instance.level_glottolog == 'language' and instance.level_glottolog != 'language':
        clear_language_specific_fields(instance, old_instance)
    
    # 1. Derive level_nal from level_glottolog and parent
    instance.level_nal = derive_level_nal(instance)
    
    # 2. Default name_abbrev to name if empty
    if not instance.name_abbrev:
        instance.name_abbrev = instance.name
    
    # 3. Derive family/subgroup FKs from parent_languoid chain
    derive_hierarchy_fks(instance)


@receiver(post_save, sender=Languoid)
def schedule_languoid_hierarchy_update(sender, instance, created, **kwargs):
    """
    Schedule unified hierarchy update task after save.
    
    This handles:
    - Orphaning dialect children (if level changed from language)
    - Updating descendents M2M for this languoid and ancestors
    
    BATCH MODE: Skips task scheduling if _skip_async_tasks flag is set.
    """
    # BATCH MODE: Skip individual task scheduling
    if hasattr(instance, '_skip_async_tasks') and instance._skip_async_tasks:
        logger.debug(f"Skipping async tasks for '{instance.name}' (batch mode)")
        return
    
    # Check if hierarchy fields changed
    if not created and kwargs.get('update_fields'):
        hierarchy_fields = {
            'parent_languoid', 'family_languoid', 
            'pri_subgroup_languoid', 'sec_subgroup_languoid',
            'level_nal', 'level_glottolog'
        }
        if not hierarchy_fields.intersection(kwargs['update_fields']):
            # Check if we still need to orphan dialects
            if not hasattr(instance, '_needs_dialect_orphaning'):
                return  # No hierarchy changes, skip
    
    # Debounce: prevent duplicate tasks
    from django.core.cache import cache
    cache_key = f"updating_hierarchy_{instance.pk}"
    if cache.get(cache_key):
        return
    cache.set(cache_key, True, timeout=10)
    
    # Extract flags and clean up instance
    needs_orphaning = hasattr(instance, '_needs_dialect_orphaning')
    if needs_orphaning:
        delattr(instance, '_needs_dialect_orphaning')
    
    old_parent_id = getattr(instance, '_old_parent_id', None)
    if old_parent_id is not None:
        delattr(instance, '_old_parent_id')
    
    # Schedule SINGLE unified task (Priority 9)
    from .tasks import update_languoid_hierarchy_task
    update_languoid_hierarchy_task.apply_async(
        args=[instance.id, needs_orphaning, old_parent_id],
        priority=9  # Highest priority - user is waiting
    )


@receiver(post_save, sender=Languoid)
def schedule_cascading_dialect_updates(sender, instance, created, **kwargs):
    """
    Schedule delayed async task to cascade hierarchy updates to dialect descendants.
    Only runs when a family or language changes hierarchy fields.
    
    BATCH MODE: Skips task scheduling if _skip_async_tasks flag is set.
    """
    # BATCH MODE: Skip individual task scheduling
    if hasattr(instance, '_skip_async_tasks') and instance._skip_async_tasks:
        return
    
    # Only run for families and languages
    if instance.level_glottolog not in ['family', 'language']:
        return
    
    # Check if hierarchy fields changed
    if not created and kwargs.get('update_fields'):
        hierarchy_fields = {
            'parent_languoid', 'family_languoid',
            'pri_subgroup_languoid', 'sec_subgroup_languoid'
        }
        if not hierarchy_fields.intersection(kwargs['update_fields']):
            return
    
    # Debounce: prevent duplicate tasks
    from django.core.cache import cache
    cache_key = f"cascade_dialects_{instance.pk}"
    if cache.get(cache_key):
        return
    cache.set(cache_key, True, timeout=30)
    
    # Schedule DELAYED task (Priority 5)
    from .tasks import cascade_hierarchy_to_dialects_task
    cascade_hierarchy_to_dialects_task.apply_async(
        args=[instance.id],
        priority=5,  # Medium priority - background work
        countdown=2  # Wait 2 seconds for Priority 9 task to finish
    )


@receiver(post_save, sender=Languoid)
@receiver(post_delete, sender=Languoid)
def invalidate_languoid_list_cache(sender, instance, **kwargs):
    """
    Invalidate and rebuild the languoid list cache when any languoid is saved or deleted.
    
    This ensures users always see fresh data after edits.
    The cache rebuild happens in the background via Celery.
    
    BATCH MODE: Skips cache invalidation if _skip_async_tasks flag is set.
    """
    # BATCH MODE: Skip individual cache invalidation
    if hasattr(instance, '_skip_async_tasks') and instance._skip_async_tasks:
        return
    
    from .tasks import invalidate_and_warm_languoid_cache
    
    # Trigger cache invalidation + background rebuild
    # Priority 8 = High (user just made an edit, wants fresh data soon)
    invalidate_and_warm_languoid_cache.apply_async(priority=8)