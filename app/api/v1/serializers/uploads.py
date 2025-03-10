from rest_framework import serializers
from deposits.models import DepositFile, Deposit
from django.contrib.auth import get_user_model
import mimetypes
import os

User = get_user_model()

class DepositFileSerializer(serializers.ModelSerializer):
    """Serializer for deposit files"""
    uploaded_by = serializers.ReadOnlyField(source='uploaded_by.username')
    
    class Meta:
        model = DepositFile
        fields = [
            'id',
            'deposit',
            'file',
            'filename',
            'filetype',
            'filesize',
            'uploaded_at',
            'uploaded_by',
            'is_metadata_file',
        ]
        read_only_fields = ['filename', 'filetype', 'filesize', 'uploaded_at', 'uploaded_by']
    
    def create(self, validated_data):
        # Get the file from the request
        file_obj = validated_data['file']
        
        # Set filename if not provided
        if 'filename' not in validated_data or not validated_data['filename']:
            validated_data['filename'] = os.path.basename(file_obj.name)
        
        # Set filetype based on mimetype
        if 'filetype' not in validated_data or not validated_data['filetype']:
            mimetype, _ = mimetypes.guess_type(validated_data['filename'])
            validated_data['filetype'] = mimetype or 'application/octet-stream'
        
        # Set filesize
        validated_data['filesize'] = file_obj.size
        
        # Set uploaded_by to current user
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['uploaded_by'] = request.user
        
        return super().create(validated_data) 