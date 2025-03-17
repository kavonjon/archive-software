import os
import shutil
import logging
from django.conf import settings
from celery import shared_task
from datetime import datetime, timedelta
from metadata.models import Collection, Item
from django.db.models import Min, Max

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
    logger.info("Starting collection date range update")
    collections = Collection.objects.all()
    update_count = 0
    
    for collection in collections:
        # Get min and max dates from items in this collection
        items = Item.objects.filter(collection=collection)
        
        # Find the earliest and latest dates from items
        # First check collection_date_min and collection_date_max
        min_date = items.exclude(collection_date_min=None).aggregate(Min('collection_date_min'))['collection_date_min__min']
        max_date = items.exclude(collection_date_max=None).aggregate(Max('collection_date_max'))['collection_date_max__max']
        
        # If no collection dates, try other date fields (you can add more as needed)
        if min_date is None:
            min_date = items.exclude(accession_date_min=None).aggregate(Min('accession_date_min'))['accession_date_min__min']
        if max_date is None:
            max_date = items.exclude(accession_date_max=None).aggregate(Max('accession_date_max'))['accession_date_max__max']
        
        # Format the date_range text based on min and max dates
        date_range = format_date_range(min_date, max_date)
        
        # Only update if values have changed
        if (collection.date_range_min != min_date or 
            collection.date_range_max != max_date or 
            collection.date_range != date_range):
            
            collection.date_range_min = min_date
            collection.date_range_max = max_date
            collection.date_range = date_range
            collection.save(update_fields=['date_range_min', 'date_range_max', 'date_range'])
            update_count += 1
    
    logger.info(f"Updated date ranges for {update_count} collections")
    return update_count

def format_date_range(min_date, max_date):
    """
    Format date range as YYYY/MM/DD-YYYY/MM/DD with appropriate simplifications
    """
    if min_date is None or max_date is None:
        return ""
    
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