import json
import tempfile
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from deposits.models import Deposit, DepositFile
from deposits.metadata import MetadataProcessor

User = get_user_model()

class MetadataProcessorTests(TestCase):
    def setUp(self):
        # Create a test user
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpassword'
        )
        
        # Create a test deposit
        self.deposit = Deposit.objects.create(
            title='Test Deposit',
            draft_user=self.user,
            format_version='unknown',
            deposit_type='NEW'
        )
        
    def create_metadata_file(self, content):
        """Helper to create a metadata file with given content"""
        json_content = json.dumps(content).encode('utf-8')
        file = SimpleUploadedFile(
            name='metadata.json',
            content=json_content,
            content_type='application/json'
        )
        
        deposit_file = DepositFile.objects.create(
            deposit=self.deposit,
            file=file,
            filename='metadata.json',
            filetype='application/json',
            filesize=len(json_content),
            uploaded_by=self.user,
            is_metadata_file=True
        )
        
        return deposit_file
        
    def test_valid_metadata_processing(self):
        """Test processing a valid metadata file"""
        # Create valid metadata content
        metadata_content = {
            'format': 'archive_deposit_json_v0.1',
            'versions': [
                {
                    'version': 1,
                    'timestamp': timezone.now().isoformat(),
                    'data': {
                        'title': 'Test Item',
                        'description': 'Test Description'
                    }
                }
            ]
        }
        
        # Create file and process
        file = self.create_metadata_file(metadata_content)
        processor = MetadataProcessor(self.deposit)
        result = processor.process_metadata_file(file)
        
        # Refresh deposit from database
        self.deposit.refresh_from_db()
        
        # Assertions
        self.assertTrue(result)
        self.assertEqual(self.deposit.format_version, 'archive_deposit_json_v0.1')
        self.assertIn('versions', self.deposit.metadata)
        self.assertEqual(len(self.deposit.metadata['versions']), 1)
        
    def test_invalid_json_processing(self):
        """Test processing an invalid JSON file"""
        # Create invalid JSON content
        invalid_json = b'{"format": "test", "versions": [{'
        
        # Create file manually since it's not valid JSON
        file = SimpleUploadedFile(
            name='invalid.json',
            content=invalid_json,
            content_type='application/json'
        )
        
        deposit_file = DepositFile.objects.create(
            deposit=self.deposit,
            file=file,
            filename='invalid.json',
            filetype='application/json',
            filesize=len(invalid_json),
            uploaded_by=self.user,
            is_metadata_file=True
        )
        
        # Process file
        processor = MetadataProcessor(self.deposit)
        result = processor.process_metadata_file(deposit_file)
        
        # Assertions
        self.assertFalse(result)
        
    def test_missing_required_fields(self):
        """Test processing metadata missing required fields"""
        # Create metadata without required fields
        metadata_content = {
            'title': 'Test Item',
            'description': 'Test Description'
        }
        
        # Create file and process
        file = self.create_metadata_file(metadata_content)
        processor = MetadataProcessor(self.deposit)
        result = processor.process_metadata_file(file)
        
        # Assertions
        self.assertFalse(result)
        
    def test_version_extraction(self):
        """Test extracting version data from metadata"""
        # Create metadata with multiple versions
        metadata_content = {
            'format': 'archive_deposit_json_v0.1',
            'versions': [
                {
                    'version': 1,
                    'timestamp': '2023-01-01T00:00:00Z',
                    'data': {
                        'title': 'Initial Title'
                    }
                },
                {
                    'version': 2,
                    'timestamp': '2023-01-02T00:00:00Z',
                    'data': {
                        'title': 'Updated Title'
                    }
                }
            ]
        }
        
        # Create file and process
        file = self.create_metadata_file(metadata_content)
        processor = MetadataProcessor(self.deposit)
        result = processor.process_metadata_file(file)
        
        # Refresh deposit from database
        self.deposit.refresh_from_db()
        
        # Assertions
        self.assertTrue(result)
        self.assertEqual(len(self.deposit.metadata['versions']), 1)
        self.assertEqual(
            self.deposit.metadata['versions'][0]['data']['title'], 
            'Updated Title'
        )
        
    def test_updating_existing_metadata(self):
        """Test updating existing metadata with new file"""
        # First, create initial metadata
        initial_metadata = {
            'format': 'archive_deposit_json_v0.1',
            'versions': [
                {
                    'version': 1,
                    'timestamp': '2023-01-01T00:00:00Z',
                    'data': {
                        'title': 'Initial Title'
                    }
                }
            ]
        }
        
        initial_file = self.create_metadata_file(initial_metadata)
        processor = MetadataProcessor(self.deposit)
        processor.process_metadata_file(initial_file)
        
        # Now create updated metadata
        updated_metadata = {
            'format': 'archive_deposit_json_v0.1',
            'versions': [
                {
                    'version': 1,
                    'timestamp': '2023-01-02T00:00:00Z',
                    'data': {
                        'title': 'Updated Title'
                    }
                }
            ]
        }
        
        # Delete old file and create new one
        initial_file.delete()
        updated_file = self.create_metadata_file(updated_metadata)
        
        # Process updated file
        result = processor.process_metadata_file(updated_file)
        
        # Refresh deposit from database
        self.deposit.refresh_from_db()
        
        # Assertions
        self.assertTrue(result)
        self.assertEqual(len(self.deposit.metadata['versions']), 2)
        self.assertEqual(
            self.deposit.metadata['versions'][1]['data']['title'], 
            'Updated Title'
        )
        
    def test_schema_validation(self):
        """Test schema validation for metadata"""
        # Create metadata with invalid schema (missing required title)
        metadata_content = {
            'format': 'archive_deposit_json_v0.1',
            'versions': [
                {
                    'version': 1,
                    'timestamp': timezone.now().isoformat(),
                    'data': {
                        # Missing required 'title' field
                        'description': 'Test Description'
                    }
                }
            ]
        }
        
        # Create file and process
        file = self.create_metadata_file(metadata_content)
        processor = MetadataProcessor(self.deposit)
        result = processor.process_metadata_file(file)
        
        # Assertions
        self.assertFalse(result)  # Should fail validation
        self.assertTrue(any('Schema validation error' in error for error in processor.validation_errors))
        
        # Now create valid metadata
        valid_metadata = {
            'format': 'archive_deposit_json_v0.1',
            'versions': [
                {
                    'version': 1,
                    'timestamp': timezone.now().isoformat(),
                    'data': {
                        'title': 'Valid Title',
                        'description': 'Test Description',
                        'language': [
                            {
                                'id': 'eng',
                                'name': 'English'  # Add required name field
                            }
                        ]
                    }
                }
            ]
        }
        
        # Delete old file and create new one
        file.delete()
        valid_file = self.create_metadata_file(valid_metadata)
        
        # Process valid file
        result = processor.process_metadata_file(valid_file)
        
        # Assertions
        self.assertTrue(result)
        self.assertEqual(len(processor.validation_errors), 0)
        
    def test_complex_schema_validation(self):
        """Test validation of complex nested structures"""
        # Create metadata with valid complex structure
        metadata_content = {
            'format': 'archive_deposit_json_v0.1',
            'versions': [
                {
                    'version': 1,
                    'timestamp': timezone.now().isoformat(),
                    'data': {
                        'title': 'Complex Item',
                        'description': 'Item with complex structure',
                        'language': [
                            {
                                'id': 'eng',
                                'name': 'English'
                            },
                            {
                                'id': 'spa',
                                'name': 'Spanish'
                            }
                        ],
                        'collaborators': [
                            {
                                'id': '1',
                                'name': 'John Doe',
                                'roles': ['researcher', 'recorder']
                            }
                        ]
                    }
                }
            ]
        }
        
        # Create file and process
        file = self.create_metadata_file(metadata_content)
        processor = MetadataProcessor(self.deposit)
        result = processor.process_metadata_file(file)
        
        # Assertions
        self.assertTrue(result)
        
        # Now create invalid complex structure (missing required field in nested object)
        invalid_metadata = {
            'format': 'archive_deposit_json_v0.1',
            'versions': [
                {
                    'version': 1,
                    'timestamp': timezone.now().isoformat(),
                    'data': {
                        'title': 'Complex Item',
                        'language': [
                            {
                                'id': 'eng'
                                # Missing required 'name' field
                            }
                        ]
                    }
                }
            ]
        }
        
        # Delete old file and create new one
        file.delete()
        invalid_file = self.create_metadata_file(invalid_metadata)
        
        # Process invalid file
        processor = MetadataProcessor(self.deposit)
        result = processor.process_metadata_file(invalid_file)
        
        # Assertions
        self.assertFalse(result)
        self.assertTrue(any('Schema validation error' in error for error in processor.validation_errors)) 