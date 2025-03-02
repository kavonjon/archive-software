from rest_framework import serializers
from deposits.models import Deposit
from .collections import CollectionListSerializer
from django.contrib.auth import get_user_model

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username']

class DepositListSerializer(serializers.ModelSerializer):
    """Serializer for deposit list view"""
    draft_user = UserSerializer(read_only=True)
    collections = CollectionListSerializer(many=True, read_only=True)

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
    collections = CollectionListSerializer(many=True, read_only=True)

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