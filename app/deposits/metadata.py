import json
import logging
import jsonschema
from django.core.exceptions import ValidationError
from django.utils import timezone
from .schemas import METADATA_SCHEMA

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
    
    def __init__(self, deposit):
        self.deposit = deposit
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
        Validate the format of the metadata JSON.
        
        Args:
            metadata: Parsed JSON object
            
        Returns:
            bool: True if valid, False otherwise
        """
        # Check format version
        if 'format' not in metadata:
            logger.error("Missing 'format' field in metadata")
            self.validation_errors.append("Missing 'format' field")
            return False
            
        # Store format version in deposit
        self.deposit.format_version = metadata.get('format', 'unknown')
        self.deposit.save(update_fields=['format_version'])
        
        # Basic structure validation
        required_fields = ['format', 'versions']
        for field in required_fields:
            if field not in metadata:
                logger.error(f"Missing required field '{field}' in metadata")
                self.validation_errors.append(f"Missing required field '{field}'")
                return False
                
        return True
    
    def _validate_schema(self, metadata):
        """
        Validate metadata against the JSON schema.
        
        Args:
            metadata: Parsed JSON object
            
        Returns:
            bool: True if valid, False otherwise
        """
        try:
            jsonschema.validate(instance=metadata, schema=METADATA_SCHEMA)
            return True
        except jsonschema.exceptions.ValidationError as e:
            logger.error(f"Schema validation error: {str(e)}")
            self.validation_errors.append(f"Schema validation error: {e.message}")
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