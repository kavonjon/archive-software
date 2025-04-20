import os
import json
import shutil
import logging
from django.conf import settings
from django.contrib.auth.decorators import login_required, permission_required
from django.shortcuts import get_object_or_404, redirect, render
from django.contrib import messages
from metadata.models import File

logger = logging.getLogger(__name__)

# Base paths
def get_main_storage_base():
    """Get the base path for storage based on server role"""
    if settings.SERVER_ROLE == 'private':
        return settings.MAIN_STORAGE_PATH
    else:  # public server
        return settings.PUBLIC_STORAGE_PATH

def get_files_path():
    """Get the path to the files directory"""
    base = get_main_storage_base()
    if not base:
        return None
    return os.path.join(base, 'files')

def get_metadata_path():
    """Get the path to the metadata directory"""
    base = get_main_storage_base()
    if not base:
        return None
    return os.path.join(base, 'metadata')

# Collection and item paths
def get_collection_files_path(collection_id):
    """Get the path to a collection's files directory"""
    files_path = get_files_path()
    if not files_path:
        return None
    return os.path.join(files_path, str(collection_id))

def get_collection_files_path_by_abbr(collection_abbr):
    """Get the path to a collection's files directory using abbreviation"""
    files_path = get_files_path()
    if not files_path:
        return None
    return os.path.join(files_path, str(collection_abbr))

def get_collection_metadata_path(collection_id):
    """Get the path to a collection's metadata directory"""
    metadata_path = get_metadata_path()
    if not metadata_path:
        return None
    return os.path.join(metadata_path, str(collection_id))

def get_collection_metadata_path_by_abbr(collection_abbr):
    """Get the path to a collection's metadata directory using abbreviation"""
    metadata_path = get_metadata_path()
    if not metadata_path:
        return None
    return os.path.join(metadata_path, str(collection_abbr))

def get_item_files_path(collection_id, item_id):
    """Get the path to an item's files directory"""
    collection_path = get_collection_files_path(collection_id)
    if not collection_path:
        return None
    return os.path.join(collection_path, str(item_id))

def get_item_files_path_by_numbers(collection_abbr, catalog_number):
    """Get the path to an item's files directory using collection abbreviation and catalog number"""
    collection_path = get_collection_files_path_by_abbr(collection_abbr)
    if not collection_path:
        return None
    return os.path.join(collection_path, str(catalog_number))

def get_item_metadata_path(collection_id, item_id):
    """Get the path to an item's metadata directory"""
    collection_path = get_collection_metadata_path(collection_id)
    if not collection_path:
        return None
    return os.path.join(collection_path, str(item_id))

def get_item_metadata_path_by_numbers(collection_abbr, catalog_number):
    """Get the path to an item's metadata directory using collection abbreviation and catalog number"""
    collection_path = get_collection_metadata_path_by_abbr(collection_abbr)
    if not collection_path:
        return None
    return os.path.join(collection_path, str(catalog_number))

# Ensure directory structure exists
def ensure_directory_structure(collection_id, item_id=None, collection_abbr=None, catalog_number=None):
    """
    Ensure the directory structure exists for a collection or item
    
    Args:
        collection_id: ID of the collection (legacy, not used if collection_abbr provided)
        item_id: ID of the item (legacy, not used if catalog_number provided)
        collection_abbr: Collection abbreviation (preferred)
        catalog_number: Catalog number (preferred)
    """
    # Create main directories if they don't exist
    files_path = get_files_path()
    metadata_path = get_metadata_path()
    
    if not files_path or not metadata_path:
        return False
    
    os.makedirs(files_path, exist_ok=True)
    os.makedirs(metadata_path, exist_ok=True)
    
    # Determine which path format to use
    if collection_abbr:
        # Create collection directories using abbreviation
        collection_files_path = get_collection_files_path_by_abbr(collection_abbr)
        collection_metadata_path = get_collection_metadata_path_by_abbr(collection_abbr)
        
        os.makedirs(collection_files_path, exist_ok=True)
        os.makedirs(collection_metadata_path, exist_ok=True)
        
        # Create item directories if needed
        if catalog_number:
            item_files_path = get_item_files_path_by_numbers(collection_abbr, catalog_number)
            item_metadata_path = get_item_metadata_path_by_numbers(collection_abbr, catalog_number)
            
            os.makedirs(item_files_path, exist_ok=True)
            os.makedirs(item_metadata_path, exist_ok=True)
    
    return True

# File listing functions
def list_item_files(collection_id, item_id):
    """List all files in an item's files directory"""
    item_path = get_item_files_path(collection_id, item_id)
    if not item_path or not os.path.exists(item_path):
        return []
    
    # List only files, not directories
    return [f for f in os.listdir(item_path) 
            if os.path.isfile(os.path.join(item_path, f))]

def list_item_files_by_numbers(collection_abbr, catalog_number):
    """List all files in an item's files directory using collection abbreviation and catalog number"""
    item_path = get_item_files_path_by_numbers(collection_abbr, catalog_number)
    if not item_path or not os.path.exists(item_path):
        return []
    
    # List only files, not directories
    return [f for f in os.listdir(item_path) 
            if os.path.isfile(os.path.join(item_path, f))]

# Metadata handling
def save_collection_metadata(collection_id, metadata):
    """Save collection metadata to JSON file"""
    collection_metadata_path = get_collection_metadata_path(collection_id)
    if not collection_metadata_path:
        return False
    
    # Ensure directory exists
    ensure_directory_structure(collection_id)
    
    # Create metadata filename
    metadata_file = os.path.join(collection_metadata_path, f"{collection_id}_metadata.json")
    
    try:
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)
        return True
    except Exception as e:
        logger.error(f"Error saving collection metadata: {str(e)}")
        return False

def save_item_metadata(collection_id, item_id, metadata, collection_abbr=None, catalog_number=None):
    """Save item metadata to JSON file"""
    if collection_abbr and catalog_number:
        # Use the new path format
        item_metadata_path = get_item_metadata_path_by_numbers(collection_abbr, catalog_number)
        file_id = catalog_number
    else:
        # Fall back to legacy format for backward compatibility
        item_metadata_path = get_item_metadata_path(collection_id, item_id)
        file_id = item_id
        
    if not item_metadata_path:
        return False
    
    # Ensure directory exists
    if collection_abbr and catalog_number:
        ensure_directory_structure(None, None, collection_abbr, catalog_number)
    else:
        ensure_directory_structure(collection_id, item_id)
    
    # Create metadata filename
    metadata_file = os.path.join(item_metadata_path, f"{file_id}_metadata.json")
    
    try:
        with open(metadata_file, 'w') as f:
            json.dump(metadata, f, indent=2)
        return True
    except Exception as e:
        logger.error(f"Error saving item metadata: {str(e)}")
        return False

def load_collection_metadata(collection_id):
    """Load collection metadata from JSON file"""
    collection_metadata_path = get_collection_metadata_path(collection_id)
    if not collection_metadata_path:
        return None
    
    # Create metadata filename
    metadata_file = os.path.join(collection_metadata_path, f"{collection_id}_metadata.json")
    
    if not os.path.exists(metadata_file):
        return {}
    
    try:
        with open(metadata_file, 'r') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading collection metadata: {str(e)}")
        return {}

def load_item_metadata(collection_id, item_id, collection_abbr=None, catalog_number=None):
    """Load item metadata from JSON file"""
    if collection_abbr and catalog_number:
        # Use the new path format
        item_metadata_path = get_item_metadata_path_by_numbers(collection_abbr, catalog_number)
        file_id = catalog_number
    else:
        # Fall back to legacy format for backward compatibility
        item_metadata_path = get_item_metadata_path(collection_id, item_id)
        file_id = item_id
        
    if not item_metadata_path:
        return None
    
    # Create metadata filename
    metadata_file = os.path.join(item_metadata_path, f"{file_id}_metadata.json")
    
    if not os.path.exists(metadata_file):
        return {}
    
    try:
        with open(metadata_file, 'r') as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Error loading item metadata: {str(e)}")
        return {}

# File operations
def save_derivative(collection_id, item_id, original_filename, derivative_data, derivative_type):
    """
    Save a derivative file (thumbnail, preview, etc.)
    
    Args:
        collection_id: ID of the collection
        item_id: ID of the item
        original_filename: Original filename this derivative is based on
        derivative_data: The data to save (bytes)
        derivative_type: Type of derivative (e.g., 'thumbnail', 'preview')
    
    Returns:
        Path to the saved derivative or None on failure
    """
    item_metadata_path = get_item_metadata_path(collection_id, item_id)
    if not item_metadata_path:
        return None
    
    # Ensure directory exists
    ensure_directory_structure(collection_id, item_id)
    
    # Create derivative filename (preserve original extension if applicable)
    base_name, ext = os.path.splitext(original_filename)
    derivative_file = os.path.join(
        item_metadata_path, 
        f"{base_name}_{derivative_type}{ext}"
    )
    
    try:
        with open(derivative_file, 'wb') as f:
            f.write(derivative_data)
        return derivative_file
    except Exception as e:
        logger.error(f"Error saving derivative: {str(e)}")
        return None

def update_file_metadata(collection_id, item_id, file_list, collection_abbr=None, catalog_number=None):
    """
    Update the file metadata for an item (JSON export only)
    Note: This is only for export purposes - 
    the primary source of selected files is now the File model objects
    
    Args:
        collection_id: ID of the collection
        item_id: ID of the item
        file_list: List of filenames to include in the metadata
        collection_abbr: Collection abbreviation (preferred)
        catalog_number: Catalog number (preferred)
    """
    metadata = load_item_metadata(collection_id, item_id, collection_abbr, catalog_number) or {}
    
    # Update the files list in the metadata for export purposes
    metadata['files'] = file_list
    
    # Save the updated metadata
    return save_item_metadata(collection_id, item_id, metadata, collection_abbr, catalog_number)

@login_required
@permission_required('metadata.change_item')
def item_files(request, item_id):
    """
    View for managing files associated with an item
    """
    from metadata.models import File
    
    item = get_object_or_404(Item, pk=item_id)
    
    # Check that the item has a collection assigned
    if not item.collection:
        messages.error(request, "Item must be assigned to a collection before managing files")
        return redirect('item_detail', item_id=item_id)
    
    # Get the list of available files
    available_files = item.get_item_files()
    
    # Get selected files exclusively from File objects
    file_objects = File.objects.filter(item=item)
    selected_files = [file_obj.filename for file_obj in file_objects]
    
    # Handle form submission
    if request.method == 'POST':
        selected_files = request.POST.getlist('selected_files', [])
        
        if item.save_file_selection(selected_files):
            messages.success(request, "File selection updated successfully")
        else:
            messages.error(request, "Error updating file selection")
        
        return redirect('item_files', item_id=item_id)
    
    # Prepare the context for rendering the template
    context = {
        'item': item,
        'available_files': available_files,
        'selected_files': selected_files,
    }
    
    return render(request, 'metadata/item_files.html', context) 