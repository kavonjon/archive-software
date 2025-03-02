from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from deposits.models import Deposit
from ..serializers.deposits import (
    DepositListSerializer,
    DepositDetailSerializer,
)
from rest_framework import status
from django.core.exceptions import PermissionDenied

class DepositViewSet(viewsets.ModelViewSet):
    """
    API endpoint for deposits
    """
    queryset = Deposit.objects.all()
    permission_classes = [permissions.IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'list':
            return DepositListSerializer
        return DepositDetailSerializer
    
    def get_queryset(self):
        """
        Filter deposits based on user permissions:
        - Archivists see all deposits
        - Users see deposits where they are draft_user or involved_user
        """
        user = self.request.user
        if user.has_perm('deposits.can_manage_deposits'):
            return Deposit.objects.all()
        return Deposit.objects.filter(
            Q(draft_user=user) | 
            Q(involved_users=user)
        ).distinct()

    def perform_create(self, serializer):
        """Set draft_user to current user on create"""
        serializer.save(draft_user=self.request.user)

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit a draft deposit for review"""
        deposit = self.get_object()
        
        try:
            success = deposit.transition_to('REVIEW', request.user)
            if success:
                return Response({'status': 'deposit submitted for review'})
            else:
                return Response(
                    {'status': 'failed to submit deposit', 'reason': 'validation failed'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except PermissionDenied as e:
            return Response(
                {'status': 'permission denied', 'reason': str(e)},
                status=status.HTTP_403_FORBIDDEN
            )

    @action(detail=True, methods=['post'])
    def review_action(self, request, pk=None):
        """Take action on a deposit under review"""
        deposit = self.get_object()
        action = request.data.get('action')
        comment = request.data.get('comment', '')
        
        if action not in ['accept', 'reject', 'request_revision']:
            return Response(
                {'status': 'invalid action', 'valid_actions': ['accept', 'reject', 'request_revision']},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Map action to state
        state_map = {
            'accept': 'ACCEPTED',
            'reject': 'REJECTED',
            'request_revision': 'NEEDS_REVISION'
        }
        
        target_state = state_map[action]
        
        try:
            success = deposit.transition_to(target_state, request.user, comment)
            if success:
                return Response({'status': f'deposit {action}ed'})
            else:
                return Response(
                    {'status': f'failed to {action} deposit', 'reason': 'validation failed'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except PermissionDenied as e:
            return Response(
                {'status': 'permission denied', 'reason': str(e)},
                status=status.HTTP_403_FORBIDDEN
            )

    @action(detail=True, methods=['get'])
    def possible_actions(self, request, pk=None):
        """Get possible actions for the current deposit state"""
        deposit = self.get_object()
        current_state = deposit.state
        
        # Get possible target states
        from deposits.workflow import DepositWorkflow
        possible_states = DepositWorkflow.ALLOWED_TRANSITIONS.get(current_state, [])
        
        # Filter by user permissions
        allowed_states = [
            state for state in possible_states
            if deposit.can_transition_to(state, request.user)
        ]
        
        # Map states to user-friendly actions
        action_map = {
            'REVIEW': 'submit',
            'NEEDS_REVISION': 'request_revision',
            'REJECTED': 'reject',
            'ACCEPTED': 'accept',
            'DRAFT': 'return_to_draft',
            'INCOMPLETE': 'close'
        }
        
        actions = [action_map.get(state, state.lower()) for state in allowed_states]
        
        return Response({
            'current_state': current_state,
            'possible_actions': actions
        }) 