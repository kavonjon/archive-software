from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from datetime import datetime, timedelta
from deposits.reports import DepositReportService
from rest_framework import status

class ReportViewSet(viewsets.ViewSet):
    """
    API endpoint for deposit reports and analytics
    """
    permission_classes = [permissions.IsAuthenticated]
    
    @action(detail=False, methods=['get'])
    def deposit_stats(self, request):
        """Get deposit statistics"""
        # Parse date parameters
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        print(f"Debug - received start_date: {start_date}")  # Add debug print
        
        # Set default date range if no dates provided
        if not start_date and not end_date:
            end_date = timezone.now()
            start_date = end_date - timedelta(days=30)
        else:
            # Parse provided dates if they exist
            if start_date:
                try:
                    # Fix improper ISO format with space before timezone
                    if ' ' in start_date:
                        start_date = start_date.replace(' ', '+')
                    
                    start_date = datetime.fromisoformat(start_date)
                    if start_date.tzinfo is None:
                        start_date = timezone.make_aware(start_date)
                    print(f"Debug - parsed start_date: {start_date}")  # Add debug print
                except ValueError as e:
                    print(f"Debug - parse error: {e}")  # Add debug print
                    return Response(
                        {'error': 'Invalid start_date format. Use ISO format with timezone.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            if end_date:
                try:
                    # Fix improper ISO format with space before timezone
                    if ' ' in end_date:
                        end_date = end_date.replace(' ', '+')
                        
                    end_date = datetime.fromisoformat(end_date)
                    if end_date.tzinfo is None:
                        end_date = timezone.make_aware(end_date)
                except ValueError:
                    return Response(
                        {'error': 'Invalid end_date format. Use ISO format with timezone.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            # Fill in missing dates with defaults
            if end_date and not start_date:
                start_date = end_date - timedelta(days=30)
            if start_date and not end_date:
                end_date = timezone.now()
        
        # Get user if filtering by current user
        user = None
        if request.query_params.get('current_user') == 'true':
            user = request.user
            
        # Get statistics
        stats = DepositReportService.get_deposit_stats(
            start_date=start_date,
            end_date=end_date,
            user=user
        )
        
        return Response(stats)
    
    @action(detail=False, methods=['get'])
    def activity_timeline(self, request):
        """Get deposit activity timeline"""
        # Parse parameters
        interval = request.query_params.get('interval', 'day')
        days = int(request.query_params.get('days', 30))
        
        # Get user if filtering by current user
        user = None
        if request.query_params.get('current_user') == 'true':
            user = request.user
            
        # Get timeline data
        timeline = DepositReportService.get_activity_timeline(
            interval=interval,
            days=days,
            user=user
        )
        
        return Response(timeline)
    
    @action(detail=False, methods=['get'])
    def user_activity(self, request):
        """Get user activity statistics"""
        # Parse parameters
        days = int(request.query_params.get('days', 30))
        
        # Check permissions - only staff/admin should see all user activity
        if not request.user.is_staff:
            return Response({'error': 'Permission denied'}, status=403)
            
        # Get user activity data
        activity = DepositReportService.get_user_activity(days=days)
        
        return Response(activity) 