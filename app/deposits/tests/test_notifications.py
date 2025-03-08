from django.test import TestCase
from django.urls import reverse
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from deposits.models import Deposit, Notification, DepositFile
from deposits.workflow import DepositWorkflow

User = get_user_model()

class NotificationModelTests(TestCase):
    def setUp(self):
        # Create users
        self.draft_user = User.objects.create_user(
            username='drafter',
            email='drafter@example.com',
            password='password123'
        )
        
        self.reviewer = User.objects.create_user(
            username='reviewer',
            email='reviewer@example.com',
            password='password123'
        )
        
        # Give reviewer permission to review
        from django.contrib.auth.models import Permission
        from django.contrib.contenttypes.models import ContentType
        content_type = ContentType.objects.get_for_model(Deposit)
        permission = Permission.objects.get(
            codename='can_review_deposits',
            content_type=content_type,
        )
        self.reviewer.user_permissions.add(permission)
        
        # Create a deposit
        self.deposit = Deposit.objects.create(
            title='Test Deposit',
            draft_user=self.draft_user,
            state='DRAFT',
            is_draft=True
        )
        
        # Add reviewer as involved user
        self.deposit.involved_users.add(self.reviewer)
    
    def test_notification_creation_on_state_change(self):
        """Test that notifications are created when deposit state changes"""
        # Initial notification count
        initial_count = Notification.objects.count()
        
        # Add a file to the deposit so it can transition to REVIEW
        DepositFile.objects.create(
            deposit=self.deposit,
            filename='test_file.txt',
            filesize=1000
        )
        
        # Transition deposit to REVIEW
        self.deposit.transition_to('REVIEW', self.draft_user)
        
        # Check that a notification was created for the reviewer
        self.assertEqual(Notification.objects.count(), initial_count + 1)
        notification = Notification.objects.first()
        self.assertEqual(notification.user, self.reviewer)
        self.assertEqual(notification.deposit, self.deposit)
        self.assertEqual(notification.notification_type, 'STATE_CHANGE')
        self.assertIn('changed from DRAFT to REVIEW', notification.message)
        
        # Now have reviewer request revision
        self.deposit.transition_to('NEEDS_REVISION', self.reviewer, comment='Please fix this')
        
        # Should create 2 notifications: state change and system notification for draft user
        self.assertEqual(Notification.objects.count(), initial_count + 3)
        
        # Check that draft user received both notifications
        draft_user_notifications = Notification.objects.filter(user=self.draft_user)
        self.assertEqual(draft_user_notifications.count(), 2)
        
        # Check for system notification
        system_notification = draft_user_notifications.filter(notification_type='SYSTEM').first()
        self.assertIsNotNone(system_notification)
        self.assertIn('needs revision', system_notification.message)
        
        # Check for comment in state change notification
        state_notification = draft_user_notifications.filter(notification_type='STATE_CHANGE').first()
        self.assertIsNotNone(state_notification)
        self.assertIn('Please fix this', state_notification.message)
    
    def test_notification_for_acceptance(self):
        """Test special notifications for acceptance"""
        # Set deposit to REVIEW state first
        self.deposit.state = 'REVIEW'
        self.deposit.save()
        
        # Add a metadata file to the deposit so it can transition to ACCEPTED
        file = DepositFile.objects.create(
            deposit=self.deposit,
            filename='metadata.json',
            filesize=1000,
            is_metadata_file=True
        )
        
        # Clear existing notifications
        Notification.objects.all().delete()
        
        # Accept the deposit
        self.deposit.transition_to('ACCEPTED', self.reviewer)
        
        # Should create 2 notifications for draft user: state change and acceptance
        draft_user_notifications = Notification.objects.filter(user=self.draft_user)
        self.assertEqual(draft_user_notifications.count(), 2)
        
        # Check for acceptance notification
        system_notification = draft_user_notifications.filter(notification_type='SYSTEM').first()
        self.assertIsNotNone(system_notification)
        self.assertIn('has been accepted', system_notification.message)

    def tearDown(self):
        # Clean up all notifications
        Notification.objects.all().delete()

class NotificationAPITests(TestCase):
    def setUp(self):
        # Create user
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='password123'
        )
        
        # Create deposit
        self.deposit = Deposit.objects.create(
            title='Test Deposit',
            draft_user=self.user,
            state='DRAFT'
        )
        
        # Create notifications
        self.notification1 = Notification.objects.create(
            user=self.user,
            deposit=self.deposit,
            notification_type='SYSTEM',
            message='Test notification 1',
            read=False
        )
        
        self.notification2 = Notification.objects.create(
            user=self.user,
            deposit=self.deposit,
            notification_type='STATE_CHANGE',
            message='Test notification 2',
            read=True
        )
        
        # Create API client
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
    
    def test_list_notifications(self):
        """Test retrieving user's notifications"""
        url = reverse('api:v1:notification-list')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 2)  # Check paginated results
    
    def test_mark_notification_read(self):
        """Test marking a notification as read"""
        url = reverse('api:v1:notification-mark-read', kwargs={'pk': self.notification1.id})
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Refresh from database
        self.notification1.refresh_from_db()
        self.assertTrue(self.notification1.read)
    
    def test_mark_all_read(self):
        """Test marking all notifications as read"""
        url = reverse('api:v1:notification-mark-all-read')
        response = self.client.post(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Check all notifications are marked as read
        unread_count = Notification.objects.filter(user=self.user, read=False).count()
        self.assertEqual(unread_count, 0)
    
    def test_unread_count(self):
        """Test getting unread notification count"""
        url = reverse('api:v1:notification-unread-count')
        response = self.client.get(url)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['unread_count'], 1)
        
        # Mark all as read
        Notification.objects.filter(user=self.user).update(read=True)
        
        # Check count is updated
        response = self.client.get(url)
        self.assertEqual(response.data['unread_count'], 0)
    
    def test_other_user_notifications_not_visible(self):
        """Test that users can't see other users' notifications"""
        # Create another user with notifications
        other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='password123'
        )
        
        Notification.objects.create(
            user=other_user,
            deposit=self.deposit,
            notification_type='SYSTEM',
            message='Other user notification',
            read=False
        )
        
        # Get notifications
        url = reverse('api:v1:notification-list')
        response = self.client.get(url)
        
        # Should only see own notifications
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 2) 