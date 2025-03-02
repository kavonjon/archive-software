from rest_framework import viewsets, permissions, status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db.models import Q
from deposits.models import DepositFile, Deposit
from ..serializers.uploads import DepositFileSerializer
from deposits.metadata import MetadataProcessor

class DepositFileViewSet(viewsets.ModelViewSet):
    """
    API endpoint for deposit files
    """
    queryset = DepositFile.objects.all()
    serializer_class = DepositFileSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    
    def get_queryset(self):
        """
        Filter files based on user permissions:
        - Archivists see all files
        - Users see files for deposits where they are draft_user or involved_user
        """
        user = self.request.user
        if user.has_perm('deposits.can_manage_deposits'):
            return DepositFile.objects.all()
            
        # Get deposits the user has access to
        accessible_deposits = Deposit.objects.filter(
            Q(draft_user=user) | 
            Q(involved_users=user)
        ).values_list('id', flat=True)
        
        # Filter files by those deposits
        return DepositFile.objects.filter(deposit__in=accessible_deposits)
    
    def perform_create(self, serializer):
        """Set uploaded_by to current user"""
        serializer.save(uploaded_by=self.request.user)
    
    @action(detail=True, methods=['post'])
    def set_as_metadata(self, request, pk=None):
        """Mark a file as the metadata file for the deposit"""
        file = self.get_object()
        deposit = file.deposit
        
        # Clear any existing metadata file flag
        deposit.files.filter(is_metadata_file=True).update(is_metadata_file=False)
        
        # Set this file as the metadata file
        file.is_metadata_file = True
        file.save()
        
        # Process the metadata file
        processor = MetadataProcessor(deposit)
        success = file.process_metadata()
        
        if success:
            return Response({'status': 'metadata file processed successfully'})
        else:
            return Response(
                {
                    'status': 'error processing metadata file',
                    'errors': processor.validation_errors
                },
                status=status.HTTP_400_BAD_REQUEST
            ) 