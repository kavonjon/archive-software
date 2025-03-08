from rest_framework import serializers
from deposits.models import Deposit, DepositFile
from .collections import CollectionSerializer
from django.contrib.auth import get_user_model
from django.contrib.auth.models import User

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username']

class DepositListSerializer(serializers.ModelSerializer):
    """Serializer for deposit list view"""
    draft_user = UserSerializer(read_only=True)
    collections = CollectionSerializer(many=True, read_only=True)

    class Meta:
        model = Deposit
        fields = [
            'id',
            'title',
            'state',
            'deposit_type',
            'draft_user',
            'collections',
            'created_at',
            'modified_at',
        ]

class DepositDetailSerializer(serializers.ModelSerializer):
    """Serializer for deposit detail view"""
    draft_user = UserSerializer(read_only=True)
    involved_users = UserSerializer(many=True, read_only=True)
    collections = CollectionSerializer(many=True, read_only=True)

    class Meta:
        model = Deposit
        fields = [
            'id',
            'title',
            'state',
            'is_draft',
            'deposit_type',
            'draft_user',
            'involved_users',
            'collections',
            'format_version',
            'file_count',
            'metadata',
            'created_at',
            'modified_at',
        ]

class DepositFileSerializer(serializers.ModelSerializer):
    """Serializer for deposit files"""
    uploaded_by = UserSerializer(read_only=True)
    
    class Meta:
        model = DepositFile
        fields = (
            'id', 
            'filename',
            'filetype',
            'filesize',
            'uploaded_at',
            'uploaded_by',
            'is_metadata_file',
            'file'
        )
        read_only_fields = ('uploaded_at', 'uploaded_by', 'filesize')

# Check for existing serializers here 