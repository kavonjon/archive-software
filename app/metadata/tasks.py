import os
import shutil
import logging
from django.conf import settings
from celery import shared_task
from datetime import datetime, timedelta
from metadata.models import Collection, Item
from django.db.models import Min, Max
from .utils import parse_standardized_date

logger = logging.getLogger(__name__)

@shared_task
def process_scanned_files(file_paths, scan_result):
    """
    Process files after virus scanning
    """
    if settings.SERVER_ROLE == 'public':
        destination = settings.PUBLIC_STORAGE_PATH if scan_result == 'clean' else None
    else:  # private
        destination = settings.MAIN_STORAGE_PATH if scan_result == 'clean' else None
    
    if not destination:
        logger.warning(f"Files failed virus scan: {file_paths}")
        return
    
    for file_path in file_paths:
        filename = os.path.basename(file_path)
        dest_path = os.path.join(destination, filename)
        try:
            shutil.move(file_path, dest_path)
            logger.info(f"Moved {file_path} to {dest_path}")
        except Exception as e:
            logger.error(f"Error moving file {file_path}: {str(e)}")

@shared_task
def cleanup_temp_files():
    """
    Clean up temporary files older than 24 hours
    """
    if settings.SERVER_ROLE != 'public':
        return
    
    now = datetime.now()
    temp_dir = settings.TEMP_STORAGE_PATH
    
    for filename in os.listdir(temp_dir):
        file_path = os.path.join(temp_dir, filename)
        file_modified = datetime.fromtimestamp(os.path.getmtime(file_path))
        if now - file_modified > timedelta(hours=24):
            try:
                os.remove(file_path)
                logger.info(f"Removed temporary file: {file_path}")
            except Exception as e:
                logger.error(f"Error removing temporary file {file_path}: {str(e)}")

@shared_task
def sync_public_files():
    """
    Sync files from private main storage to public storage
    """
    if settings.SERVER_ROLE != 'private':
        return
    
    # This would use a secure method to transfer files to the public server
    # Implementation depends on your specific requirements and infrastructure
    logger.info("Starting public file synchronization")
    # Example: Use rsync, sftp, or a custom API call to transfer files 

@shared_task
def update_collection_item_counts():
    """
    Update the item count for all collections
    """
    logger.info("Starting collection item count update")
    collections = Collection.objects.all()
    update_count = 0
    
    for collection in collections:
        # Count items related to this collection
        count = Item.objects.filter(collection=collection).count()
        
        # Only update if the count has changed
        if collection.item_count != count:
            collection.item_count = count
            collection.save(update_fields=['item_count'])
            update_count += 1
    
    logger.info(f"Updated item counts for {update_count} collections")
    return update_count

@shared_task
def update_collection_date_ranges():
    """
    Update the date range fields for all collections based on their items
    """
    logger.info("==== Collection Date Range Update Started ====")
    collections = Collection.objects.all()
    total_collections = collections.count()
    update_count = 0
    
    for i, collection in enumerate(collections, 1):
        # Get items for this collection
        items = Item.objects.filter(collection=collection)
        item_count = items.count()
        
        if item_count == 0:
            logger.info(f"Collection {collection.collection_abbr} has no associated items")
            continue
            
        logger.info(f"Processing collection: {collection.collection_abbr} with {item_count} items")
        
        # Find the earliest date (minimum of all item min dates)
        collection_min_date = items.exclude(collection_date_min=None).aggregate(Min('collection_date_min'))['collection_date_min__min']
        accession_min_date = items.exclude(accession_date_min=None).aggregate(Min('accession_date_min'))['accession_date_min__min']
        
        # Find the latest date (maximum of all item max dates)
        collection_max_date = items.exclude(collection_date_max=None).aggregate(Max('collection_date_max'))['collection_date_max__max']
        accession_max_date = items.exclude(accession_date_max=None).aggregate(Max('accession_date_max'))['accession_date_max__max']
        
        # Determine the overall min and max dates
        min_date = collection_min_date if collection_min_date else accession_min_date
        max_date = collection_max_date if collection_max_date else accession_max_date
        
        logger.info(f"Collection date values found:")
        logger.info(f"  - Collection date min: {collection_min_date}")
        logger.info(f"  - Collection date max: {collection_max_date}")
        logger.info(f"  - Accession date min: {accession_min_date}")
        logger.info(f"  - Accession date max: {accession_max_date}")
        logger.info(f"  - Overall min date: {min_date}")
        logger.info(f"  - Overall max date: {max_date}")
        
        # Format the date range text
        date_range = format_date_range(min_date, max_date)
        logger.info(f"  - Formatted date range: '{date_range}'")
        
        # Compare with existing values
        if (collection.date_range_min != min_date or 
            collection.date_range_max != max_date or 
            collection.date_range != date_range):
            
            logger.info(f"Updating collection: {collection.collection_abbr} - {collection.name}")
            if collection.date_range != date_range:
                logger.info(f"  Date range changing from '{collection.date_range}' to '{date_range}'")
            
            # Only update if we actually have dates
            if min_date is not None or max_date is not None:
                collection.date_range_min = min_date
                collection.date_range_max = max_date
                collection.date_range = date_range
                collection.save(update_fields=['date_range_min', 'date_range_max', 'date_range'])
                update_count += 1
            else:
                logger.info(f"  Skipping update - no valid dates found")
        
        # Progress indicator
        if i % 10 == 0:
            logger.info(f"Progress: {i}/{total_collections} collections processed")
    
    logger.info(f"==== Collection Date Range Update Completed ====")
    logger.info(f"Updated {update_count} of {total_collections} collections")
    return update_count

@shared_task
def update_item_date_ranges():
    """
    Update the min/max date fields for all items based on their text date fields
    """
    logger.info("=" * 50)
    logger.info("Item Date Range Update Started")
    logger.info("=" * 50)
    
    items = Item.objects.all()
    total_items = items.count()
    update_count = 0
    
    logger.info(f"Found {total_items} items to process")
    
    date_field_pairs = {
        'accession_date': ('accession_date_min', 'accession_date_max'),
        'cataloged_date': ('cataloged_date_min', 'cataloged_date_max'),
        'collection_date': ('collection_date_min', 'collection_date_max'),
        'creation_date': ('creation_date_min', 'creation_date_max'),
        'deposit_date': ('deposit_date_min', 'deposit_date_max'),
    }

    for i, item in enumerate(items, 1):
        item_updated = False
        updates_for_item = []
        
        for text_field, (min_field, max_field) in date_field_pairs.items():
            current_value = getattr(item, text_field)
            if not current_value:
                continue
                
            min_date, max_date = parse_standardized_date(current_value)
            current_min = getattr(item, min_field)
            current_max = getattr(item, max_field)
            
            if min_date != current_min or max_date != current_max:
                updates_for_item.append({
                    'field': text_field,
                    'old_min': current_min,
                    'old_max': current_max,
                    'new_min': min_date,
                    'new_max': max_date,
                    'text_value': current_value
                })
                setattr(item, min_field, min_date)
                setattr(item, max_field, max_date)
                item_updated = True
        
        if item_updated:
            logger.info(f"Updating item: {item.catalog_number}")
            for update in updates_for_item:
                logger.info(
                    f"  {update['field']}:\n"
                    f"    Text: {update['text_value']}\n"
                    f"    Old range: {update['old_min']} to {update['old_max']}\n"
                    f"    New range: {update['new_min']} to {update['new_max']}"
                )
            item.save()
            update_count += 1
            
        # Progress indicator every 100 items
        if i % 100 == 0:
            logger.info(f"Progress: {i}/{total_items} items processed ({(i/total_items)*100:.1f}%)")
    
    logger.info("=" * 50)
    logger.info(f"Item Date Range Update Completed")
    logger.info(f"Updated {update_count} of {total_items} items")
    logger.info("=" * 50)
    
    return update_count

def format_date_range(min_date, max_date):
    """
    Format date range as YYYY/MM/DD-YYYY/MM/DD with appropriate simplifications
    """
    if min_date is None and max_date is None:
        logger.info("  Cannot format date range - both min_date and max_date are None")
        return ""
    
    # If only one date is available, use it for both min and max
    if min_date is None and max_date is not None:
        logger.info("  Only max_date is available, using it for both min and max")
        min_date = max_date
    elif max_date is None and min_date is not None:
        logger.info("  Only min_date is available, using it for both min and max")
        max_date = min_date
    
    try:
        # Format full dates
        min_str = min_date.strftime("%Y/%m/%d")
        max_str = max_date.strftime("%Y/%m/%d")
        
        # Same year
        if min_date.year == max_date.year:
            # Same year, same month
            if min_date.month == max_date.month:
                # Same day (exact date)
                if min_date.day == max_date.day:
                    return f"{min_date.year}/{min_date.month:02d}/{min_date.day:02d}"
                # Same year, same month, different days
                else:
                    return f"{min_date.year}/{min_date.month:02d}/{min_date.day:02d}-{max_date.day:02d}"
            # Same year, different months
            else:
                # Check if it spans the entire year
                if min_date.month == 1 and min_date.day == 1 and max_date.month == 12 and max_date.day == 31:
                    return f"{min_date.year}"
                else:
                    return f"{min_date.year}/{min_date.month:02d}-{max_date.month:02d}"
        # Different years
        else:
            # Check if it spans entire years (Jan 1 to Dec 31)
            if min_date.month == 1 and min_date.day == 1 and max_date.month == 12 and max_date.day == 31:
                return f"{min_date.year}-{max_date.year}"
            else:
                return f"{min_str}-{max_str}"
    except Exception as e:
        logger.error(f"Error formatting date range: {str(e)}")
        return "" 