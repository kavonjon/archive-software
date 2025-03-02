import logging
from django.utils import timezone
from django.db import transaction
from django.core.exceptions import PermissionDenied

logger = logging.getLogger(__name__)

class DepositWorkflow:
    """
    Manages deposit workflow state transitions and actions.
    
    This class handles:
    - State transitions
    - Permission checks
    - Validation before state changes
    - Logging state changes
    """
    
    # Define allowed state transitions
    ALLOWED_TRANSITIONS = {
        'DRAFT': ['REVIEW'],
        'REVIEW': ['NEEDS_REVISION', 'REJECTED', 'ACCEPTED'],
        'NEEDS_REVISION': ['REVIEW', 'INCOMPLETE'],
        'REJECTED': ['DRAFT', 'INCOMPLETE'],
        'ACCEPTED': ['INCOMPLETE'],
        'INCOMPLETE': []
    }
    
    # Define required permissions for transitions
    REQUIRED_PERMISSIONS = {
        'DRAFT_to_REVIEW': None,  # Anyone with deposit access can submit for review
        'REVIEW_to_NEEDS_REVISION': 'deposits.can_review_deposits',
        'REVIEW_to_REJECTED': 'deposits.can_review_deposits',
        'REVIEW_to_ACCEPTED': 'deposits.can_review_deposits',
        'NEEDS_REVISION_to_REVIEW': None,  # Resubmit after revision
        'NEEDS_REVISION_to_INCOMPLETE': 'deposits.can_review_deposits',
        'REJECTED_to_DRAFT': None,  # Restart after rejection
        'REJECTED_to_INCOMPLETE': 'deposits.can_review_deposits',
        'ACCEPTED_to_INCOMPLETE': 'deposits.can_manage_deposits',
    }
    
    def __init__(self, deposit):
        self.deposit = deposit
        
    def can_transition_to(self, target_state, user):
        """
        Check if the deposit can transition to the target state.
        
        Args:
            target_state: The state to transition to
            user: The user attempting the transition
            
        Returns:
            bool: True if transition is allowed, False otherwise
        """
        current_state = self.deposit.state
        
        # Check if the target state is a valid transition
        if target_state not in self.ALLOWED_TRANSITIONS.get(current_state, []):
            return False
            
        # Check if user has permission for this transition
        permission_key = f"{current_state}_to_{target_state}"
        required_permission = self.REQUIRED_PERMISSIONS.get(permission_key)
        
        if required_permission and not user.has_perm(required_permission):
            return False
            
        # If no permission required, check if user is involved with the deposit
        if not required_permission:
            is_involved = (
                user == self.deposit.draft_user or
                user in self.deposit.involved_users.all()
            )
            if not is_involved:
                return False
                
        return True
        
    @transaction.atomic
    def transition_to(self, target_state, user, comment=None):
        """
        Transition the deposit to a new state.
        
        Args:
            target_state: The state to transition to
            user: The user performing the transition
            comment: Optional comment about the transition
            
        Returns:
            bool: True if successful, False otherwise
            
        Raises:
            PermissionDenied: If user doesn't have permission
        """
        if not self.can_transition_to(target_state, user):
            raise PermissionDenied(
                f"User {user.username} cannot transition deposit from "
                f"{self.deposit.state} to {target_state}"
            )
            
        # Perform pre-transition validation
        if not self._validate_transition(target_state):
            return False
            
        # Record the previous state
        previous_state = self.deposit.state
        
        # Update deposit state
        self.deposit.state = target_state
        
        # Update is_draft flag
        self.deposit.is_draft = (target_state == 'DRAFT')
        
        # Save the deposit
        self.deposit.save(update_fields=['state', 'is_draft', 'modified_at'])
        
        # Log the transition
        logger.info(
            f"Deposit {self.deposit.id} transitioned from {previous_state} "
            f"to {target_state} by {user.username}"
        )
        
        # Add state change to metadata
        self._record_state_change(previous_state, target_state, user, comment)
        
        return True
        
    def _validate_transition(self, target_state):
        """
        Validate that the deposit meets requirements for the transition.
        
        Args:
            target_state: The state to transition to
            
        Returns:
            bool: True if valid, False otherwise
        """
        # For submission to review, require at least one file
        if target_state == 'REVIEW' and self.deposit.files.count() == 0:
            logger.warning(f"Cannot transition to REVIEW: deposit {self.deposit.id} has no files")
            return False
            
        # For acceptance, require a metadata file
        if target_state == 'ACCEPTED' and not self.deposit.files.filter(is_metadata_file=True).exists():
            logger.warning(f"Cannot transition to ACCEPTED: deposit {self.deposit.id} has no metadata file")
            return False
            
        return True
        
    def _record_state_change(self, previous_state, new_state, user, comment=None):
        """
        Record the state change in the deposit's metadata.
        
        Args:
            previous_state: The previous state
            new_state: The new state
            user: The user who made the change
            comment: Optional comment about the change
        """
        # Get current metadata or initialize
        metadata = self.deposit.metadata or {}
        
        # Initialize state_changes array if it doesn't exist
        if 'state_changes' not in metadata:
            metadata['state_changes'] = []
            
        # Add the state change
        state_change = {
            'from': previous_state,
            'to': new_state,
            'timestamp': timezone.now().isoformat(),
            'user': user.username,
        }
        
        if comment:
            state_change['comment'] = comment
            
        metadata['state_changes'].append(state_change)
        
        # Update deposit metadata
        self.deposit.metadata = metadata
        self.deposit.save(update_fields=['metadata']) 