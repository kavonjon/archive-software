"""
Django management command for managing user roles and groups.

Usage:
    python manage.py manage_user_roles --help
    python manage.py manage_user_roles --list-users
    python manage.py manage_user_roles --add-to-group username "Museum Staff"
    python manage.py manage_user_roles --remove-from-group username "Museum Staff"
    python manage.py manage_user_roles --set-staff username --staff
    python manage.py manage_user_roles --set-staff username --no-staff
"""

from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.models import User, Group
from django.db import transaction


class Command(BaseCommand):
    help = 'Manage user roles and groups for the archive system'

    def add_arguments(self, parser):
        parser.add_argument('--list-users', action='store_true',
                          help='List all users with their roles and groups')
        
        parser.add_argument('--add-to-group', nargs=2, metavar=('USERNAME', 'GROUP'),
                          help='Add user to group')
        
        parser.add_argument('--remove-from-group', nargs=2, metavar=('USERNAME', 'GROUP'),
                          help='Remove user from group')
        
        parser.add_argument('--set-staff', metavar='USERNAME',
                          help='Set user staff status (use with --staff or --no-staff)')
        
        parser.add_argument('--staff', action='store_true',
                          help='Set is_staff=True (use with --set-staff)')
        
        parser.add_argument('--no-staff', action='store_true',
                          help='Set is_staff=False (use with --set-staff)')

    def handle(self, *args, **options):
        if options['list_users']:
            self.list_users()
        elif options['add_to_group']:
            username, group_name = options['add_to_group']
            self.add_user_to_group(username, group_name)
        elif options['remove_from_group']:
            username, group_name = options['remove_from_group']
            self.remove_user_from_group(username, group_name)
        elif options['set_staff']:
            username = options['set_staff']
            if options['staff'] and options['no_staff']:
                raise CommandError("Cannot use both --staff and --no-staff")
            elif options['staff']:
                self.set_staff_status(username, True)
            elif options['no_staff']:
                self.set_staff_status(username, False)
            else:
                raise CommandError("Must specify --staff or --no-staff with --set-staff")
        else:
            self.stdout.write(self.style.ERROR('No action specified. Use --help for usage.'))

    def list_users(self):
        """List all users with their roles and permissions"""
        self.stdout.write(self.style.SUCCESS('\n=== User Roles Summary ===\n'))
        
        users = User.objects.all().prefetch_related('groups')
        
        for user in users:
            role = self.determine_user_role(user)
            groups = list(user.groups.values_list('name', flat=True))
            
            self.stdout.write(f"👤 {user.username}")
            self.stdout.write(f"   Role: {role}")
            self.stdout.write(f"   Staff: {'Yes' if user.is_staff else 'No'}")
            self.stdout.write(f"   Superuser: {'Yes' if user.is_superuser else 'No'}")
            self.stdout.write(f"   Groups: {groups if groups else 'None'}")
            self.stdout.write(f"   Django Admin: {'✅' if user.is_staff else '❌'}")
            self.stdout.write(f"   API Edit Access: {'✅' if self.has_edit_access(user) else '❌'}")
            self.stdout.write("")

    def determine_user_role(self, user):
        """Determine user role based on staff status and groups"""
        if user.is_superuser:
            return "Administrator"
        elif user.is_staff and user.groups.filter(name='Archivist').exists():
            return "Archivist"
        elif user.groups.filter(name='Museum Staff').exists():
            return "Museum Staff"
        elif user.is_staff:
            return "Staff (no group)"
        else:
            return "Read-Only"

    def has_edit_access(self, user):
        """Check if user has edit access to API"""
        return (user.is_staff or 
                user.groups.filter(name__in=['Archivist', 'Museum Staff']).exists())

    def add_user_to_group(self, username, group_name):
        """Add user to specified group"""
        try:
            with transaction.atomic():
                user = User.objects.get(username=username)
                group, created = Group.objects.get_or_create(name=group_name)
                
                if created:
                    self.stdout.write(f"Created new group: {group_name}")
                
                user.groups.add(group)
                self.stdout.write(
                    self.style.SUCCESS(f"✅ Added user '{username}' to group '{group_name}'")
                )
                
        except User.DoesNotExist:
            raise CommandError(f"User '{username}' does not exist")

    def remove_user_from_group(self, username, group_name):
        """Remove user from specified group"""
        try:
            user = User.objects.get(username=username)
            group = Group.objects.get(name=group_name)
            
            user.groups.remove(group)
            self.stdout.write(
                self.style.SUCCESS(f"✅ Removed user '{username}' from group '{group_name}'")
            )
            
        except User.DoesNotExist:
            raise CommandError(f"User '{username}' does not exist")
        except Group.DoesNotExist:
            raise CommandError(f"Group '{group_name}' does not exist")

    def set_staff_status(self, username, is_staff):
        """Set user staff status"""
        try:
            user = User.objects.get(username=username)
            user.is_staff = is_staff
            user.save()
            
            status = "staff" if is_staff else "non-staff"
            self.stdout.write(
                self.style.SUCCESS(f"✅ Set user '{username}' as {status}")
            )
            
            # Warn about Django admin access implications
            if is_staff:
                self.stdout.write(
                    self.style.WARNING(f"⚠️  User '{username}' now has Django admin access")
                )
            else:
                self.stdout.write(
                    self.style.WARNING(f"⚠️  User '{username}' no longer has Django admin access")
                )
                
        except User.DoesNotExist:
            raise CommandError(f"User '{username}' does not exist")
