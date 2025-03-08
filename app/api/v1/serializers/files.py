from rest_framework import serializers
from deposits.models import DepositFile

class FileSerializer(serializers.ModelSerializer):
    class Meta:
        model = DepositFile
        fields = ['id', 'filename', 'deposit', 'uploaded_at', 'filesize', 'is_metadata_file', 'item_uuid'] 