from django.db.models.signals import post_save, post_delete, pre_save, m2m_changed
from django.dispatch import receiver
from .models import Languoid, Item, Collaborator, CollaboratorRole
from .tasks import update_collection_date_ranges
from .utils import parse_standardized_date
import logging
import base58

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

    # Sort MultiSelectField values alphabetically for consistent display and storage
    # MultiSelectField stores values as comma-separated strings internally
    multiselectfields_to_sort = ['genre', 'language_description_type']
    
    for field_name in multiselectfields_to_sort:
        current_value = getattr(instance, field_name)
        
        # MultiSelectField values are stored as lists in Python but comma-separated in DB
        if current_value and isinstance(current_value, (list, tuple)):
            # Sort the values alphabetically and set them back
            sorted_values = sorted(current_value)
            
            # Only update if the order changed (avoid unnecessary saves)
            if list(current_value) != sorted_values:
                setattr(instance, field_name, sorted_values)
    
    # Calculate browse_categories based on other field values
    # This is a fully automated field that categorizes items for browsing
    categories = []
    
    # Helper function to safely check if a value is in a field
    # MultiSelectField can return either a list or a comma-separated string
    def field_includes(field_value, check_value):
        if not field_value:
            return False
        if isinstance(field_value, (list, tuple)):
            return check_value in field_value
        if isinstance(field_value, str):
            # Handle comma-separated string (MultiSelectField storage format)
            values = [v.strip() for v in field_value.split(',') if v.strip()]
            return check_value in values
        return check_value == field_value
    
    # Get field values - MultiSelectField may return string or list
    # Convert to list for consistent handling
    def to_list(value):
        if not value:
            return []
        if isinstance(value, (list, tuple)):
            return list(value)
        if isinstance(value, str):
            return [v.strip() for v in value.split(',') if v.strip()]
        return [value]
    
    lang_desc_type = to_list(instance.language_description_type)
    genre = to_list(instance.genre)
    resource_type = instance.resource_type or ''
    public_event = instance.public_event
    
    # Language description materials
    if field_includes(lang_desc_type, 'grammar'):
        categories.append('grammars')
    if field_includes(lang_desc_type, 'grammar-specific-feature'):
        categories.append('specific-features')
    if field_includes(lang_desc_type, 'lexicon-dictionary'):
        categories.append('dictionaries')
    
    # Music categories (check for specific music_* genres)
    if field_includes(genre, 'music_powwow'):
        categories.append('powwow')
    if field_includes(genre, 'music_stomp_dance'):
        categories.append('stomp-dance')
    if field_includes(genre, 'music_hymn'):
        categories.append('hymns')
    if field_includes(genre, 'music_for_children'):
        categories.append('for-children-music')
    if field_includes(genre, 'music_forty_nine'):
        categories.append('forty-nine')
    if field_includes(genre, 'music_hand_game'):
        categories.append('hand-game')
    if field_includes(genre, 'music_native_american_church'):
        categories.append('nac')
    if field_includes(genre, 'music_war_dance'):
        categories.append('war-dance')
    if field_includes(genre, 'music_round_dance'):
        categories.append('round-dance')
    if field_includes(genre, 'music_sundance'):
        categories.append('sundance')
    
    # Other ceremonial (music_ceremonial, but excluding specific types)
    if field_includes(genre, 'music_ceremonial'):
        excluded = ['music_powwow', 'music_stomp_dance', 'music_hymn', 'music_for_children', 
                   'music_forty_nine', 'music_hand_game', 'music_native_american_church', 
                   'music_war_dance', 'music_round_dance', 'music_sundance']
        if not any(field_includes(genre, exc) for exc in excluded):
            categories.append('other-ceremonial')
    
    # Educational materials
    if field_includes(genre, 'educational_material_family'):
        categories.append('for-families')
    if field_includes(genre, 'educational_material_teachers'):
        categories.append('for-teachers')
    if field_includes(genre, 'educational_material_learners'):
        categories.append('for-learners')
    if field_includes(genre, 'educational_material_planning'):
        categories.append('for-administrators')
    
    # Texts (various primary-text subcategories)
    if field_includes(lang_desc_type, 'primary-text-igt'):
        categories.append('interlinear-glossed-texts')
    
    if field_includes(lang_desc_type, 'primary-text'):
        if field_includes(genre, 'traditional_story'):
            categories.append('literature-and-stories')
        if field_includes(genre, 'conversation'):
            categories.append('conversation')
        if field_includes(genre, 'ceremonial'):
            categories.append('religious-material')
        if field_includes(genre, 'correspondence'):
            categories.append('correspondence')
        if field_includes(genre, 'narrative'):
            categories.append('narrative')
        if field_includes(genre, 'popular_production'):
            categories.append('popular-media-text')
    
    # Videos (including audio-video)
    if resource_type in ('video', 'audio-video'):
        # For children videos - check both general for_children and music_for_children
        if field_includes(genre, 'for_children') or field_includes(genre, 'music_for_children'):
            categories.append('for-children-video')
        if public_event:
            categories.append('events')
        if field_includes(genre, 'popular_production'):
            categories.append('popular-media-video')
    
    # Set the calculated categories, sorted according to BROWSE_CATEGORY_CHOICES order
    # Remove duplicates first
    unique_categories = list(set(categories))
    
    # Sort according to the order defined in BROWSE_CATEGORY_CHOICES
    from metadata.models import BROWSE_CATEGORY_CHOICES
    # Create a lookup dict: category_value -> index in BROWSE_CATEGORY_CHOICES
    category_order = {choice[0]: idx for idx, choice in enumerate(BROWSE_CATEGORY_CHOICES)}
    # Sort by index in BROWSE_CATEGORY_CHOICES, with any unknown values at the end
    sorted_categories = sorted(unique_categories, key=lambda x: category_order.get(x, 9999))
    
    instance.browse_categories = sorted_categories
    
    # Set collection based on catalog_number prefix
    # Extract 3-letter prefix from catalog_number if it matches "ABC-..." pattern
    import re
    catalog_number = instance.catalog_number or ''
    
    # Match pattern: 3 letters followed by a hyphen (e.g., "CAR-123", "ABC-456")
    pattern_match = re.match(r'^([A-Za-z]{3})-', catalog_number)
    
    if pattern_match:
        collection_abbr = pattern_match.group(1).upper()  # Normalize to uppercase
        
        try:
            # Look up Collection by collection_abbr
            from metadata.models import Collection
            collection = Collection.objects.get(collection_abbr=collection_abbr)
            instance.collection = collection
        except Collection.DoesNotExist:
            # Pattern matched but no collection found - set to None
            instance.collection = None
        except Collection.MultipleObjectsReturned:
            # Multiple collections with same abbr - set to None (shouldn't happen, but handle gracefully)
            instance.collection = None
    # If pattern doesn't match, leave collection unchanged (don't modify it)

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
# COLLABORATOR SIGNALS
# ============================================================================

# ---------------------------------------------------------------------------
# Utility Functions (Pure Logic, No Decorators)
# ---------------------------------------------------------------------------

def build_full_name_from_components(instance):
    """
    Build full_name from first_names, nickname, last_names, and name_suffix.
    
    Format: first_names "nickname" last_names name_suffix
    - Skips empty fields (no extra spaces)
    - Adds quotes around nickname only if present
    - Trims and normalizes spacing
    
    Args:
        instance: The Collaborator instance
    
    Returns:
        str: The computed full_name
    
    Examples:
        first="Jane", nick="JJ", last="Doe", suffix="Jr." → 'Jane "JJ" Doe Jr.'
        first="Jane", nick="", last="Doe", suffix="" → 'Jane Doe'
        first="", nick="JJ", last="Doe", suffix="" → '"JJ" Doe'
    """
    parts = []
    
    # Add first names
    if instance.first_names:
        parts.append(instance.first_names.strip())
    
    # Add nickname with quotes
    if instance.nickname:
        parts.append(f'"{instance.nickname.strip()}"')
    
    # Add last names
    if instance.last_names:
        parts.append(instance.last_names.strip())
    
    # Add name suffix
    if instance.name_suffix:
        parts.append(instance.name_suffix.strip())
    
    # Join with single spaces and return
    return ' '.join(parts)


def synchronize_full_name(instance, old_instance):
    """
    Synchronize full_name with component name fields.
    
    Always rebuilds full_name from components (one-way calculation).
    This enforces proper use of structured name fields.
    
    Args:
        instance: The Collaborator instance being saved
        old_instance: The previous state from database (or None if new)
    """
    # Always recalculate full_name from components
    instance.full_name = build_full_name_from_components(instance)


def validate_anonymous_flag_change(instance, old_instance):
    """
    Validate and log warnings for anonymous flag changes.
    
    Checks if the collaborator has associated items and logs detailed
    information about which items may be affected by the status change.
    
    Different log levels based on direction:
    - False → True (making anonymous): INFO level (notification only)
    - True → False (removing anonymous): WARNING level (may need republishing)
    
    Args:
        instance: The Collaborator instance being saved
        old_instance: The previous state from database (or None if new)
    """
    # Skip if this is a new instance (no old_instance to compare)
    if not old_instance:
        return
    
    # Check if anonymous flag actually changed
    if old_instance.anonymous == instance.anonymous:
        return
    
    # Get all associated items through CollaboratorRole relationships
    item_roles = instance.collaborator_collaboratorroles.select_related(
        'item'
    ).filter(item__isnull=False)
    
    # If no associated items, no warning needed
    if not item_roles.exists():
        return
    
    # Build detailed list of affected items with their roles
    affected_items = []
    for role_obj in item_roles:
        if role_obj.item:
            affected_items.append({
                'catalog_number': role_obj.item.catalog_number,
                'roles': role_obj.role or []
            })
    
    item_count = len(affected_items)
    collaborator_display = instance.full_name or f"Collaborator {instance.collaborator_id}"
    
    # Format the items list for logging
    items_detail = '\n         '.join([
        f"- Item {item['catalog_number']}: roles={item['roles']}"
        for item in affected_items
    ])
    
    # Determine direction and log appropriately
    if not old_instance.anonymous and instance.anonymous:
        # Making anonymous (False → True) - INFO level
        logger.info(
            f"Anonymous status set for '{collaborator_display}' (ID: {instance.collaborator_id}). "
            f"This collaborator has {item_count} associated item{'s' if item_count != 1 else ''}:\n"
            f"         {items_detail}"
        )
    elif old_instance.anonymous and not instance.anonymous:
        # Removing anonymous (True → False) - WARNING level (truly warning-worthy)
        logger.warning(
            f"Anonymous status removed for '{collaborator_display}' (ID: {instance.collaborator_id}). "
            f"This collaborator has {item_count} associated item{'s' if item_count != 1 else ''} "
            f"that may need republishing:\n"
            f"         {items_detail}"
        )


def generate_collaborator_slug(instance):
    """
    Generate a unique slug from the collaborator's UUID.
    
    Uses base58 encoding of the UUID to create a short, URL-safe identifier.
    Format: xxxxx-xxxxx (5 chars, hyphen, 5 chars)
    
    Args:
        instance: The Collaborator instance
    
    Returns:
        str: The generated slug (e.g., "aBc12-DeF34")
    """
    encoded = base58.b58encode(instance.uuid.bytes).decode()[:10]
    return f"{encoded[:5]}-{encoded[5:10]}"


def update_collaborator_date_ranges(instance, old_instance):
    """
    Update birthdate_min/max and deathdate_min/max from text date fields.
    
    Mirrors the Item model's date range calculation pattern.
    Standardizes date format first, then parses to min/max date objects.
    
    This replaces the old Collaborator.clean() method, ensuring date
    standardization happens on ALL saves (API, admin, bulk operations),
    not just during form validation.
    
    Args:
        instance: The Collaborator instance being saved
        old_instance: The previous state from database (or None if new)
    """
    # Dictionary mapping text date fields to their corresponding min/max fields
    date_field_pairs = {
        'birthdate': ('birthdate_min', 'birthdate_max'),
        'deathdate': ('deathdate_min', 'deathdate_max'),
    }
    
    # Process each date field
    for text_field, (min_field, max_field) in date_field_pairs.items():
        current_value = getattr(instance, text_field)
        
        # Skip if the field hasn't changed (performance optimization)
        if old_instance and current_value == getattr(old_instance, text_field):
            continue
        
        # Standardize the date format first (converts MM/DD/YYYY to YYYY/MM/DD)
        standardized_value = standardize_date_format(current_value)
        setattr(instance, text_field, standardized_value)
        
        # Parse the standardized date and update min/max fields
        min_date, max_date = parse_standardized_date(standardized_value)
        setattr(instance, min_field, min_date)
        setattr(instance, max_field, max_date)


# ---------------------------------------------------------------------------
# Main Pre-Save Signal (Orchestrates All Pre-Save Operations)
# ---------------------------------------------------------------------------

@receiver(pre_save, sender=Collaborator)
def compute_collaborator_derived_fields(sender, instance, **kwargs):
    """
    Compute all derived fields before save.
    
    This handles:
    1. Slug generation (if not already set)
       - Replaces slug logic from Collaborator.save() method
    2. Full name synchronization (always calculated from components)
       - Builds full_name from first_names, nickname, last_names, name_suffix
       - One-way calculation (components are source of truth)
    3. Anonymous flag validation (logs warnings for status changes)
       - Logs INFO when making anonymous (False → True)
       - Logs WARNING when removing anonymous (True → False)
       - Includes detailed list of affected items and roles
    4. Date standardization and range calculation (birthdate, deathdate)
       - Replaces the old Collaborator.clean() method
       - Ensures dates are standardized on ALL saves (API, admin, bulk)
    """
    # Get old instance once for all comparisons
    old_instance = None
    if instance.pk:
        try:
            old_instance = Collaborator.objects.get(pk=instance.pk)
        except Collaborator.DoesNotExist:
            pass
    
    # 1. Generate slug if not already set (for new instances)
    if not instance.slug:
        instance.slug = generate_collaborator_slug(instance)
    
    # 2. Full name synchronization (always recalculate from components)
    synchronize_full_name(instance, old_instance)
    
    # 3. Anonymous flag validation (log warnings for status changes)
    validate_anonymous_flag_change(instance, old_instance)
    
    # 4. Date standardization and range calculation
    update_collaborator_date_ranges(instance, old_instance)


# ---------------------------------------------------------------------------
# M2M Signal: Auto-add Parent Languages for Dialects
# ---------------------------------------------------------------------------

@receiver(m2m_changed, sender=Collaborator.native_languages.through)
@receiver(m2m_changed, sender=Collaborator.other_languages.through)
def auto_add_parent_language_for_collaborator_dialects(sender, instance, action, pk_set, **kwargs):
    """
    Automatically add parent languages when dialects are present in Collaborator language fields.
    
    When a dialect exists in native_languages or other_languages, this signal
    ensures the parent language is also included in the same field.
    
    This maintains consistency and supports the hierarchical display pattern.
    
    Triggers on:
    - post_add: When new languoids are added
    - post_clear: After all languoids are removed (before new ones added via .set())
    - post_remove: After languoids are removed
    
    Args:
        sender: The through model (Django's auto-generated M2M table)
        instance: The Collaborator instance
        action: The M2M action ('post_add', 'post_clear', 'post_remove')
        pk_set: Set of Languoid PKs being added/removed (None for post_clear)
    """
    # Only act on post_add, post_clear, or post_remove
    # post_clear happens during .set() before post_add
    if action not in ('post_add', 'post_clear', 'post_remove'):
        return
    
    # Determine which field we're working with based on the through model table name
    # Django's auto-generated through tables have predictable names
    through_model_name = sender._meta.db_table
    
    if 'native_languages' in through_model_name:
        language_field = instance.native_languages
        field_name = 'native_languages'
    elif 'other_languages' in through_model_name:
        language_field = instance.other_languages
        field_name = 'other_languages'
    else:
        logger.warning(
            f"Could not determine which language field to update for Collaborator {instance.collaborator_id}. "
            f"Through model: {through_model_name}"
        )
        return
    
    # Get ALL current languoids in the field (not just the ones being added)
    # This ensures we check consistency after any change
    current_languoids = language_field.all()
    
    # Find all dialects currently in the field and their parent languages
    parent_language_ids = set()
    for languoid in current_languoids:
        if languoid.level_glottolog == 'dialect' and languoid.parent_languoid:
            parent_language_ids.add(languoid.parent_languoid.id)
    
    if not parent_language_ids:
        return  # No dialects with parents in the field
    
    # Get current language IDs in the field
    current_language_ids = set(language_field.values_list('id', flat=True))
    
    # Find parent languages that are not already in the field
    missing_parent_ids = parent_language_ids - current_language_ids
    
    if missing_parent_ids:
        # Add missing parent languages using the M2M manager
        language_field.add(*missing_parent_ids)
        
        logger.info(
            f"Auto-added {len(missing_parent_ids)} parent language(s) to "
            f"Collaborator {instance.collaborator_id} ({instance.full_name}) "
            f"field '{field_name}': {list(missing_parent_ids)}"
        )


@receiver(m2m_changed, sender=Item.language.through)
def auto_add_parent_language_for_item_dialects(sender, instance, action, pk_set, **kwargs):
    """
    Automatically add parent languages when dialects are present in Item language field.
    
    When a dialect exists in an Item's language field, this signal
    ensures the parent language is also included.
    
    This maintains consistency and supports the hierarchical display pattern.
    
    Triggers on:
    - post_add: When new languoids are added
    - post_clear: After all languoids are removed (before new ones added via .set())
    - post_remove: After languoids are removed
    
    Args:
        sender: The through model (Django's auto-generated M2M table)
        instance: The Item instance
        action: The M2M action ('post_add', 'post_clear', 'post_remove')
        pk_set: Set of Languoid PKs being added/removed (None for post_clear)
    """
    # Only act on post_add, post_clear, or post_remove
    if action not in ('post_add', 'post_clear', 'post_remove'):
        return
    
    # Get ALL current languoids in the field (not just the ones being added)
    # This ensures we check consistency after any change
    current_languoids = instance.language.all()
    
    # Find all dialects currently in the field and their parent languages
    parent_language_ids = set()
    for languoid in current_languoids:
        if languoid.level_glottolog == 'dialect' and languoid.parent_languoid:
            parent_language_ids.add(languoid.parent_languoid.id)
    
    if not parent_language_ids:
        return  # No dialects with parents in the field
    
    # Get current language IDs in the field
    current_language_ids = set(instance.language.values_list('id', flat=True))
    
    # Find parent languages that are not already in the field
    missing_parent_ids = parent_language_ids - current_language_ids
    
    if missing_parent_ids:
        # Add missing parent languages using the M2M manager
        instance.language.add(*missing_parent_ids)
        
        logger.info(
            f"Auto-added {len(missing_parent_ids)} parent language(s) to "
            f"Item {instance.catalog_number} "
            f"field 'language': {list(missing_parent_ids)}"
        )


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


@receiver(post_save, sender=Collaborator)
@receiver(post_delete, sender=Collaborator)
def invalidate_collaborator_list_cache(sender, instance, **kwargs):
    """
    Invalidate and rebuild the collaborator list cache when any collaborator is saved or deleted.
    
    This ensures users always see fresh data after edits.
    The cache rebuild happens in the background via Celery.
    
    BATCH MODE: Skips cache invalidation if _skip_async_tasks flag is set.
    """
    # BATCH MODE: Skip individual cache invalidation
    if hasattr(instance, '_skip_async_tasks') and instance._skip_async_tasks:
        return
    
    from .tasks import invalidate_and_warm_collaborator_cache
    
    # Trigger cache invalidation + background rebuild
    # Priority 8 = High (user just made an edit, wants fresh data soon)
    invalidate_and_warm_collaborator_cache.apply_async(priority=8)