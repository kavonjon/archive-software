from django.db import models
from django.contrib.auth import get_user_model
from metadata.models import Collection
from .storage import DepositStorage
import os
from .metadata import MetadataProcessor

User = get_user_model()

class Deposit(models.Model):
    STATES = [
        ('DRAFT', 'Draft'),
        ('REVIEW', 'Under Review'),
        ('NEEDS_REVISION', 'Needs Revision'),
        ('REJECTED', 'Rejected'),
        ('ACCEPTED', 'Accepted'),
        ('INCOMPLETE', 'Incomplete/Closed'),
    ]

    DEPOSIT_TYPES = [
        ('NEW', 'New Deposit'),
        ('CHANGE', 'Change Request'),
    ]

    # Cached fields for efficiency
    state = models.CharField(max_length=20, choices=STATES, default='DRAFT')
    is_draft = models.BooleanField(default=True)
    draft_user = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='draft_deposits'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    modified_at = models.DateTimeField(auto_now=True)
    involved_users = models.ManyToManyField(
        User,
        related_name='involved_deposits'
    )
    
    # Additional tracking fields
    title = models.CharField(max_length=255)
    format_version = models.CharField(max_length=50)
    file_count = models.IntegerField(default=0)
    collections = models.ManyToManyField(
        Collection,
        related_name='deposit_collections'
    )
    deposit_type = models.CharField(
        max_length=10,
        choices=DEPOSIT_TYPES,
        default='NEW'
    )
    
    # Main data store
    metadata = models.JSONField(default=dict)

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        # Auto-generate title if not set
        if not self.title:
            collections_str = '_'.join(
                self.collections.values_list('collection_abbr', flat=True)
            ) or 'no_collections'
            user_str = self.draft_user.username if self.draft_user else 'no_user'
            self.title = f"{self.created_at.strftime('%Y%m%d')}_{user_str}_{collections_str}"
        super().save(*args, **kwargs)

    class Meta:
        ordering = ['-modified_at']
        permissions = [
            ("can_review_deposits", "Can review deposits"),
            ("can_manage_deposits", "Can manage all deposits"),
        ]

    def get_workflow(self):
        """Get the workflow manager for this deposit"""
        from .workflow import DepositWorkflow
        return DepositWorkflow(self)
    
    def can_transition_to(self, state, user):
        """Check if deposit can transition to the given state"""
        return self.get_workflow().can_transition_to(state, user)
    
    def transition_to(self, state, user, comment=None):
        """Transition deposit to the given state"""
        return self.get_workflow().transition_to(state, user, comment)

class DepositFile(models.Model):
    """
    A file associated with a deposit.
    """
    deposit = models.ForeignKey(
        Deposit,
        on_delete=models.CASCADE,
        related_name='files'
    )
    file = models.FileField(
        upload_to='%Y/%m/%d',
        storage=DepositStorage()
    )
    filename = models.CharField(max_length=255)
    filetype = models.CharField(max_length=100, blank=True)
    filesize = models.BigIntegerField(default=0)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='uploaded_files'
    )
    is_metadata_file = models.BooleanField(default=False)
    
    def __str__(self):
        return self.filename
    
    def save(self, *args, **kwargs):
        # Set filename from the file if not provided
        if not self.filename and self.file:
            self.filename = os.path.basename(self.file.name)
            
        # Update deposit file count
        super().save(*args, **kwargs)
        self.deposit.file_count = self.deposit.files.count()
        self.deposit.save(update_fields=['file_count'])

    def process_metadata(self):
        """
        Process this file as a metadata file for the deposit.
        
        Returns:
            bool: True if successful, False otherwise
        """
        if not self.is_metadata_file:
            return False
        
        processor = MetadataProcessor(self.deposit)
        return processor.process_metadata_file(self)