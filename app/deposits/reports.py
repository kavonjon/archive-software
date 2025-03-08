import logging
from django.db.models import Count, Avg, F, Q, Sum, Case, When, IntegerField
from django.db.models.functions import TruncDay, TruncMonth, TruncYear
from django.utils import timezone
from datetime import timedelta
from .models import Deposit, DepositFile, Notification

logger = logging.getLogger(__name__)

class DepositReportService:
    """
    Service for generating deposit-related reports and analytics.
    """
    
    @staticmethod
    def get_deposit_stats(start_date=None, end_date=None, user=None):
        """
        Get deposit statistics for the given date range and user.
        
        Args:
            start_date: Optional start date for filtering
            end_date: Optional end date for filtering
            user: Optional user for filtering
            
        Returns:
            dict: Dictionary of deposit statistics
        """
        # Initialize query
        deposits = Deposit.objects.all()
        
        # Apply date filters if provided
        if start_date:
            deposits = deposits.filter(created_at__gte=start_date)
        if end_date:
            deposits = deposits.filter(created_at__lte=end_date)
            
        # Apply user filter if provided
        if user:
            deposits = deposits.filter(
                Q(draft_user=user) | Q(involved_users=user)
            ).distinct()
        
        # Calculate statistics
        stats = {
            'total_deposits': deposits.count(),
            'deposits_by_state': dict(
                deposits.values('state').annotate(count=Count('id')).values_list('state', 'count')
            ),
            'deposits_by_type': dict(
                deposits.values('deposit_type').annotate(count=Count('id')).values_list('deposit_type', 'count')
            ),
            'avg_files_per_deposit': deposits.aggregate(avg=Avg('file_count'))['avg'] or 0,
            'total_files': DepositFile.objects.filter(deposit__in=deposits).count(),
        }
        
        # Add time-based metrics
        if start_date and end_date:
            days = (end_date - start_date).days or 1  # Avoid division by zero
            stats['deposits_per_day'] = stats['total_deposits'] / days
        
        return stats
    
    @staticmethod
    def get_activity_timeline(interval='day', days=30, user=None):
        """
        Get deposit activity timeline.
        
        Args:
            interval: Time interval ('day', 'month', 'year')
            days: Number of days to look back
            user: Optional user for filtering
            
        Returns:
            list: Timeline data
        """
        # Determine truncation function based on interval
        if interval == 'month':
            trunc_func = TruncMonth
        elif interval == 'year':
            trunc_func = TruncYear
        else:  # default to day
            trunc_func = TruncDay
            
        # Calculate start date
        end_date = timezone.now()
        start_date = end_date - timedelta(days=days)
        
        # Initialize query
        deposits = Deposit.objects.filter(created_at__gte=start_date, created_at__lte=end_date)
        
        # Apply user filter if provided
        if user:
            deposits = deposits.filter(
                Q(draft_user=user) | Q(involved_users=user)
            ).distinct()
        
        # Get timeline data
        timeline = deposits.annotate(
            date=trunc_func('created_at')
        ).values('date').annotate(
            count=Count('id'),
            draft_count=Sum(Case(
                When(state='DRAFT', then=1),
                default=0,
                output_field=IntegerField()
            )),
            review_count=Sum(Case(
                When(state='REVIEW', then=1),
                default=0,
                output_field=IntegerField()
            )),
            accepted_count=Sum(Case(
                When(state='ACCEPTED', then=1),
                default=0,
                output_field=IntegerField()
            ))
        ).order_by('date')
        
        return list(timeline)
    
    @staticmethod
    def get_user_activity(days=30):
        """
        Get user activity statistics.
        
        Args:
            days: Number of days to look back
            
        Returns:
            dict: User activity statistics
        """
        # Calculate start date
        end_date = timezone.now()
        start_date = end_date - timedelta(days=days)
        
        # Get deposits created in period
        deposits = Deposit.objects.filter(created_at__gte=start_date)
        
        # Get top users by deposits created
        top_creators = deposits.values(
            'draft_user__username'
        ).annotate(
            count=Count('id')
        ).exclude(
            draft_user__isnull=True
        ).order_by('-count')[:10]
        
        # Get top users by state changes
        from django.contrib.auth import get_user_model
        User = get_user_model()
        
        # This is a simplification - in a real system you might extract this from metadata
        # or have a separate StateChange model
        notifications = Notification.objects.filter(
            notification_type='STATE_CHANGE',
            created_at__gte=start_date
        )
        
        return {
            'top_creators': list(top_creators),
            'total_active_users': User.objects.filter(
                Q(draft_deposits__created_at__gte=start_date) |
                Q(involved_deposits__created_at__gte=start_date)
            ).distinct().count(),
            'notification_count': notifications.count(),
        } 