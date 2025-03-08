from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from datetime import timedelta
import json

from deposits.models import Deposit, DepositFile, Notification
from deposits.reports import DepositReportService

User = get_user_model()

class ReportServiceTests(TestCase):
    """Tests for the DepositReportService"""
    
    def setUp(self):
        # Create users
        self.user1 = User.objects.create_user(
            username='user1',
            email='user1@example.com',
            password='password123'
        )
        
        self.user2 = User.objects.create_user(
            username='user2',
            email='user2@example.com',
            password='password123'
        )
        
        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@example.com',
            password='password123',
            is_staff=True
        )
        
        # Create deposits with different states and dates
        now = timezone.now()
        
        # Create deposits for user1
        self.deposit1 = Deposit.objects.create(
            title='Deposit 1',
            draft_user=self.user1,
            state='DRAFT',
            created_at=now - timedelta(days=10)
        )
        
        self.deposit2 = Deposit.objects.create(
            title='Deposit 2',
            draft_user=self.user1,
            state='REVIEW',
            created_at=now - timedelta(days=5)
        )
        
        # Create deposits for user2
        self.deposit3 = Deposit.objects.create(
            title='Deposit 3',
            draft_user=self.user2,
            state='ACCEPTED',
            created_at=now - timedelta(days=3)
        )
        
        self.deposit4 = Deposit.objects.create(
            title='Deposit 4',
            draft_user=self.user2,
            state='NEEDS_REVISION',
            created_at=now - timedelta(days=1)
        )
        
        # Add files to deposits
        self.file1 = DepositFile.objects.create(
            deposit=self.deposit1,
            filename='file1.txt',
            filesize=1000
        )
        
        self.file2 = DepositFile.objects.create(
            deposit=self.deposit1,
            filename='file2.txt',
            filesize=2000
        )
        
        self.file3 = DepositFile.objects.create(
            deposit=self.deposit2,
            filename='file3.txt',
            filesize=3000
        )
        
        # Create notifications
        Notification.objects.create(
            user=self.user1,
            deposit=self.deposit2,
            notification_type='STATE_CHANGE',
            message='State changed to REVIEW'
        )
        
        Notification.objects.create(
            user=self.user2,
            deposit=self.deposit3,
            notification_type='STATE_CHANGE',
            message='State changed to ACCEPTED'
        )
    
    def test_get_deposit_stats(self):
        """Test getting deposit statistics"""
        # Test without filters
        stats = DepositReportService.get_deposit_stats()
        
        self.assertEqual(stats['total_deposits'], 4)
        self.assertEqual(stats['total_files'], 3)
        self.assertEqual(stats['avg_files_per_deposit'], 0.75)  # 3 files / 4 deposits
        
        # Check state counts
        self.assertEqual(stats['deposits_by_state']['DRAFT'], 1)
        self.assertEqual(stats['deposits_by_state']['REVIEW'], 1)
        self.assertEqual(stats['deposits_by_state']['ACCEPTED'], 1)
        self.assertEqual(stats['deposits_by_state']['NEEDS_REVISION'], 1)
        
        # Test with date filter
        now = timezone.now()
        stats = DepositReportService.get_deposit_stats(
            start_date=now - timedelta(days=4),
            end_date=now
        )
        
        self.assertLessEqual(stats['total_deposits'], 4)  # Should be at most 4 (all deposits)
        self.assertGreaterEqual(stats['total_deposits'], 2)  # Should include at least deposit3 and deposit4
        
        # Test with user filter
        stats = DepositReportService.get_deposit_stats(user=self.user1)
        
        self.assertEqual(stats['total_deposits'], 2)  # Only deposit1 and deposit2
        self.assertEqual(stats['total_files'], 3)  # All 3 files belong to user1's deposits
    
    def test_get_activity_timeline(self):
        """Test getting activity timeline"""
        # Test default timeline (30 days)
        timeline = DepositReportService.get_activity_timeline()
        
        # Should have entries for each day with deposits
        self.assertGreaterEqual(len(timeline), 1)  # Should have at least one entry
        
        # Test with user filter
        timeline = DepositReportService.get_activity_timeline(user=self.user1)
        
        # Find the entry for 10 days ago
        ten_days_ago = next(
            (item for item in timeline if item['draft_count'] == 1),
            None
        )
        self.assertIsNotNone(ten_days_ago)
        
        # Find the entry for 5 days ago
        five_days_ago = next(
            (item for item in timeline if item['review_count'] == 1),
            None
        )
        self.assertIsNotNone(five_days_ago)
    
    def test_get_user_activity(self):
        """Test getting user activity statistics"""
        activity = DepositReportService.get_user_activity()
        
        self.assertEqual(activity['total_active_users'], 2)
        self.assertEqual(activity['notification_count'], 2)
        
        # Check top creators
        top_creators = activity['top_creators']
        self.assertEqual(len(top_creators), 2)  # Both users have created deposits
        
        # Users should have equal counts
        self.assertEqual(
            top_creators[0]['count'],
            top_creators[1]['count']
        )


class ReportAPITests(TestCase):
    """Tests for the report API endpoints"""
    
    def setUp(self):
        # Create test user
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='password123'
        )
        
        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@example.com',
            password='password123',
            is_staff=True
        )
        
        # Create API clients
        self.client = APIClient()
        self.admin_client = APIClient()
        
        # Authenticate clients
        self.client.force_authenticate(user=self.user)
        self.admin_client.force_authenticate(user=self.admin_user)
        
        # Create test deposits
        now = timezone.now()
        self.deposit1 = Deposit.objects.create(
            title='Test Deposit 1',
            draft_user=self.user,
            state='DRAFT',
            created_at=now - timedelta(days=5)
        )
        
        self.deposit2 = Deposit.objects.create(
            title='Test Deposit 2',
            draft_user=self.user,
            state='REVIEW',
            created_at=now - timedelta(days=2)
        )
    
    def test_deposit_stats_endpoint(self):
        """Test the deposit stats endpoint"""
        url = reverse('api:v1:report-deposit-stats')
        
        # Test without filters
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Test with current_user filter
        response = self.client.get(f"{url}?current_user=true")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Test with date filters
        now = timezone.now()
        start_date = now - timedelta(days=7)
        # Format date with explicit timezone
        start_date = start_date.astimezone(timezone.utc)  # Convert to UTC
        start_date_str = start_date.strftime('%Y-%m-%dT%H:%M:%S+00:00')  # Format as ISO8601 with UTC timezone
        
        response = self.client.get(f"{url}?start_date={start_date_str}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
    
    def test_activity_timeline_endpoint(self):
        """Test the activity timeline endpoint"""
        url = reverse('api:v1:report-activity-timeline')
        
        # Test default parameters
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        
        # Test with interval parameter
        response = self.client.get(f"{url}?interval=month")
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        
        # Test with current_user filter
        response = self.client.get(f"{url}?current_user=true")
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
    
    def test_user_activity_endpoint(self):
        """Test the user activity endpoint"""
        url = reverse('api:v1:report-user-activity')
        
        # Regular user should be denied access
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        
        # Admin user should have access
        response = self.admin_client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Check response structure
        self.assertIn('top_creators', response.data)
        self.assertIn('total_active_users', response.data)
        self.assertIn('notification_count', response.data) 