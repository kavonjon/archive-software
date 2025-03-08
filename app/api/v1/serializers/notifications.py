from rest_framework import serializers
from deposits.models import Notification

class NotificationSerializer(serializers.ModelSerializer):
    deposit_title = serializers.ReadOnlyField(source='deposit.title')
    deposit_id = serializers.ReadOnlyField(source='deposit.id')
    
    class Meta:
        model = Notification
        fields = [
            'id',
            'user',
            'deposit_id',
            'deposit_title',
            'notification_type',
            'message',
            'created_at',
            'read'
        ]
        read_only_fields = ['user', 'deposit_id', 'deposit_title', 'notification_type', 'message', 'created_at'] 