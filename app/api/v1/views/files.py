from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from deposits.models import DepositFile
from api.v1.serializers.files import FileSerializer

class FileViewSet(viewsets.ModelViewSet):
    queryset = DepositFile.objects.all()
    serializer_class = FileSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    @action(detail=True, methods=['post'])
    def mark_as_metadata(self, request, pk=None):
        """Mark a file as metadata"""
        file = self.get_object()
        file.is_metadata_file = True
        file.save()
        return Response(self.get_serializer(file).data)
    
    @action(detail=True, methods=['post'])
    def associate(self, request, pk=None):
        """Associate a file with an item"""
        file = self.get_object()
        item_uuid = request.data.get('item_uuid')
        
        if not item_uuid:
            return Response(
                {'error': 'Item UUID is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update the file's metadata to associate it with the item
        file.item_uuid = item_uuid
        file.save()
        
        return Response(self.get_serializer(file).data) 