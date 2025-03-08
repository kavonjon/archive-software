from rest_framework import viewsets, permissions, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from deposits.models import Notification, Deposit
from ..serializers.notifications import NotificationSerializer
from django.db.models import Q

class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for user notifications
    """
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['created_at', 'read']
    ordering = ['-created_at']
    
    def get_queryset(self):
        """Return only the current user's notifications"""
        # Filter by user and order by creation time
        return Notification.objects.filter(
            user=self.request.user
        ).order_by('-created_at')

    def get_deposit(self):
        """Get deposit from URL if this is a nested view"""
        deposit_id = self.kwargs.get('deposit_pk')
        if deposit_id:
            return Deposit.objects.get(pk=deposit_id)
        return None
    
    @action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        """Mark all notifications as read"""
        self.get_queryset().update(read=True)
        return Response({'status': 'all notifications marked as read'})
    
    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """Mark a single notification as read"""
        notification = self.get_object()
        notification.read = True
        notification.save()
        return Response({'status': 'notification marked as read'})
    
    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        """Get count of unread notifications"""
        count = self.get_queryset().filter(read=False).count()
        return Response({'unread_count': count}) 