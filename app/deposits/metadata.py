import json
import logging
import os
import glob
from datetime import datetime, timedelta
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.conf import settings
from .schemas import DepositMetadataSchema

logger = logging.getLogger(__name__)

class MetadataProcessor:
    """
    Processes metadata JSON files for deposits.
    
    This class handles:
    - Validating JSON structure
    - Extracting metadata
    - Creating system-maintained JSON
    - Tracking versions
    """
    
    def __init__(self, deposit, metadata_file=None):
        self.deposit = deposit
        self.metadata_file = metadata_file
        self.validation_errors = []
        
    def process_metadata_file(self, file_obj):
        """
        Process a metadata file and update the deposit's metadata.
        
        Args:
            file_obj: DepositFile object marked as metadata file
        
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            # Reset validation errors
            self.validation_errors = []
            
            # Read the file content
            file_content = file_obj.file.read().decode('utf-8')
            
            # Parse JSON
            metadata = json.loads(file_content)
            
            # Validate format
            if not self._validate_format(metadata):
                return False
                
            # Validate against schema
            if not self._validate_schema(metadata):
                return False
                
            # Create system-maintained JSON
            self._create_system_json(metadata)
            
            return True
            
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in metadata file: {file_obj.filename}")
            self.validation_errors.append(f"Invalid JSON: {str(e)}")
            return False
            
        except Exception as e:
            logger.error(f"Error processing metadata file: {str(e)}")
            self.validation_errors.append(f"Processing error: {str(e)}")
            return False
    
    def _validate_format(self, metadata):
        """
        Validate the basic format of the metadata.
        
        Args:
            metadata: Parsed JSON object
            
        Returns:
            bool: True if valid, False otherwise
        """
        if not isinstance(metadata, dict):
            self.validation_errors.append("Metadata must be a JSON object")
            return False
            
        if 'format' not in metadata:
            self.validation_errors.append("Missing 'format' field")
            return False
            
        if metadata['format'] != 'archive_deposit_json_v0.1':
            self.validation_errors.append(f"Unsupported format: {metadata['format']}")
            return False
            
        if 'versions' not in metadata or not isinstance(metadata['versions'], list):
            self.validation_errors.append("Missing or invalid 'versions' field")
            return False
            
        return True
    
    def _validate_schema(self, metadata):
        """
        Validate metadata against the schema.
        
        Args:
            metadata: Parsed JSON object
            
        Returns:
            bool: True if valid, False otherwise
        """
        try:
            # Use Pydantic validation instead of jsonschema
            DepositMetadataSchema(**metadata)
            return True
        except Exception as e:
            logger.error(f"Schema validation error: {str(e)}")
            self.validation_errors.append(f"Schema validation error: {str(e)}")
            return False
    
    def _create_system_json(self, uploaded_metadata):
        """
        Create or update the system-maintained JSON structure.
        
        Args:
            uploaded_metadata: Parsed JSON from uploaded file
        """
        # Get current metadata or initialize
        current_metadata = self.deposit.metadata or {}
        
        # Initialize if empty
        if not current_metadata:
            current_metadata = {
                'format': uploaded_metadata.get('format', 'archive_deposit_json_v0.1'),
                'deposit_id': str(self.deposit.id),
                'versions': []
            }
        
        # Extract the latest version from uploaded metadata
        if 'versions' in uploaded_metadata and uploaded_metadata['versions']:
            # Find the highest version number
            latest_version = max(
                (v for v in uploaded_metadata['versions'] if 'version' in v),
                key=lambda x: x['version'],
                default=None
            )
            
            if latest_version:
                # Create a new version entry
                new_version = {
                    'version': len(current_metadata['versions']) + 1,
                    'state': self.deposit.state,
                    'timestamp': timezone.now().isoformat(),
                    'modified_by': self.deposit.draft_user.username if self.deposit.draft_user else 'system',
                    'data': latest_version.get('data', {})
                }
                
                # Add to versions list
                current_metadata['versions'].append(new_version)
        
        # Update deposit metadata
        self.deposit.metadata = current_metadata
        self.deposit.save(update_fields=['metadata'])
        
        # After updating metadata, clean up old files
        self.cleanup_old_metadata_files()
    
    def validate(self):
        """
        Validates the metadata file against the schema.
        
        Returns:
            bool: True if valid, False otherwise
        """
        if not self.metadata_file:
            self.validation_errors.append("No metadata file provided")
            return False
            
        try:
            metadata_content = self.metadata_file.read().decode('utf-8')
            metadata_json = json.loads(metadata_content)
            
            # Validate using Pydantic model
            DepositMetadataSchema(**metadata_json)
            
            return True
            
        except json.JSONDecodeError as e:
            self.validation_errors.append(f"Invalid JSON: {str(e)}")
            return False
            
        except Exception as e:
            logger.error(f"Error processing metadata file: {str(e)}")
            self.validation_errors.append(f"Validation error: {str(e)}")
            return False
    
    def cleanup_old_metadata_files(self):
        """
        Removes old metadata JSON files from the media folder,
        keeping only the latest version.
        """
        try:
            # Get the deposit's media folder path
            deposit_folder = os.path.join(settings.MEDIA_ROOT, f'deposits/{self.deposit.id}')
            
            if not os.path.exists(deposit_folder):
                return
            
            # Find all JSON files in the deposit folder
            json_pattern = os.path.join(deposit_folder, '*.json')
            json_files = glob.glob(json_pattern)
            
            if not json_files or len(json_files) <= 1:
                # No files or only one file, nothing to clean up
                return
            
            # Sort files by modification time (newest first)
            json_files.sort(key=os.path.getmtime, reverse=True)
            
            # Keep the newest file, delete the rest
            newest_file = json_files[0]
            for file_path in json_files[1:]:
                try:
                    os.remove(file_path)
                    logger.info(f"Removed old metadata file: {file_path}")
                except Exception as e:
                    logger.error(f"Failed to remove old metadata file {file_path}: {str(e)}")
            
            logger.info(f"Kept newest metadata file: {newest_file}")
            
        except Exception as e:
            logger.error(f"Error during metadata file cleanup: {str(e)}")
    
    def create_draft_version(self, user, comment=None):
        """
        Creates a new draft version of the metadata.
        
        Args:
            user: The user creating the draft
            comment: Optional comment about the changes
            
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            # Get current metadata or initialize new
            current_metadata = self.deposit.metadata or {
                "format": "archive_deposit_json_v0.1",
                "deposit_id": str(self.deposit.id),
                "versions": []
            }
            
            # Check if there's already a draft version
            if any(v.get('is_draft', False) for v in current_metadata.get('versions', [])):
                # Remove existing draft version
                current_metadata['versions'] = [
                    v for v in current_metadata['versions'] if not v.get('is_draft', False)
                ]
            
            # Get the latest version or create initial data
            if current_metadata['versions']:
                latest_version = current_metadata['versions'][0]
                version_number = latest_version['version'] + 1
            else:
                latest_version = {
                    'data': {}
                }
                version_number = 1
            
            # Create a new version entry
            new_version = {
                'version': version_number,
                'state': self.deposit.state,
                'timestamp': timezone.now().isoformat(),
                'modified_by': user.username if user else 'system',
                'is_draft': True,
                'comment': comment or "Draft changes",
                'data': latest_version.get('data', {})
            }
            
            # Add to versions list (at the beginning)
            current_metadata['versions'].insert(0, new_version)
            
            # Update deposit metadata
            self.deposit.metadata = current_metadata
            self.deposit.save(update_fields=['metadata'])
            
            # Clean up old metadata files
            self.cleanup_old_metadata_files()
            
            return True
            
        except Exception as e:
            logger.error(f"Error creating draft version: {str(e)}")
            self.validation_errors.append(f"Failed to create draft: {str(e)}")
            return False
    
    def discard_draft(self):
        """
        Discards the draft version of the metadata.
        
        Returns:
            bool: True if successful, False otherwise
        """
        try:
            # Get current metadata
            current_metadata = self.deposit.metadata
            
            if not current_metadata or 'versions' not in current_metadata:
                return False
            
            # Check if there's a draft version
            draft_index = next((i for i, v in enumerate(current_metadata['versions']) 
                               if v.get('is_draft', False)), None)
            
            if draft_index is None:
                # No draft version found
                return False
            
            # Remove the draft version
            current_metadata['versions'].pop(draft_index)
            
            # Update deposit metadata
            self.deposit.metadata = current_metadata
            self.deposit.save(update_fields=['metadata'])
            
            # Clean up old metadata files
            self.cleanup_old_metadata_files()
            
            return True
            
        except Exception as e:
            logger.error(f"Error discarding draft: {str(e)}")
            self.validation_errors.append(f"Failed to discard draft: {str(e)}")
            return False

    def update_metadata(self, updated_data, user=None, comment=None):
        """
        Updates the metadata with new data.
        """
        try:
            # ... existing code ...
            
            # After updating metadata, clean up old files
            self.cleanup_old_metadata_files()
            
            return True
            
        except Exception as e:
            # ... existing error handling ... 
            pass