import os
from celery import Celery
from celery.schedules import crontab
import socket
import platform

# Fix for macOS fork issues
if platform.system() == 'Darwin':  # macOS
    os.environ.setdefault('OBJC_DISABLE_INITIALIZE_FORK_SAFETY', 'YES')
    os.environ.setdefault('FORKED_BY_MULTIPROCESSING', '1')

# Set the default Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'archive.settings')

# Initialize Django before creating Celery app
import django
django.setup()

app = Celery('archive')

# Use settings prefixed with CELERY_ in settings.py
app.config_from_object('django.conf:settings', namespace='CELERY')

# Ensure Redis password is included in broker URL
redis_password = os.environ.get('REDIS_PASSWORD')
redis_url = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')

# Check if we're running in Docker or development
# In Docker, we can resolve the 'redis' hostname, but in dev we use 'localhost'
def is_docker():
    """Check if we're running in a Docker container by looking for specific env markers"""
    return os.path.exists('/.dockerenv') or os.environ.get('DOCKER_CONTAINER') == 'true'

def can_resolve_hostname(hostname):
    """Check if a hostname can be resolved"""
    try:
        socket.gethostbyname(hostname)
        return True
    except socket.error:
        return False

# Choose the right Redis host
if 'localhost' not in redis_url and 'redis' in redis_url and not can_resolve_hostname('redis'):
    # We're trying to connect to 'redis' host but can't resolve it (development mode)
    redis_url = redis_url.replace('redis:', 'localhost:')

# Ensure password is included in the URL
if redis_password and '://' in redis_url:
    protocol, rest = redis_url.split('://', 1)
    if '@' not in rest:
        host_part = rest
        app.conf.broker_url = f"{protocol}://:{redis_password}@{host_part}"
        app.conf.result_backend = app.conf.broker_url
        print(f"Celery configured with Redis URL: {protocol}://:{redis_password[:3]}***@{host_part}")
    else:
        # URL already has auth, use as-is
        app.conf.broker_url = redis_url
        app.conf.result_backend = redis_url
        print(f"Using existing Redis URL with auth: {redis_url[:20]}***")
else:
    # No password or malformed URL, use default
    app.conf.broker_url = redis_url
    app.conf.result_backend = redis_url
    print(f"Using Redis URL without auth: {redis_url}")

# Configure Celery worker settings
if platform.system() == 'Darwin':  # macOS
    # Use prefork pool on macOS to avoid fork issues
    app.conf.worker_pool = 'prefork'
    app.conf.worker_concurrency = int(os.environ.get('CELERY_WORKER_CONCURRENCY', 4))

# Validate Django configuration for Celery workers
def validate_django_config():
    """Validate that Django is properly configured for Celery workers"""
    try:
        from django.conf import settings
        from django.core.files.storage import default_storage
        import os
        
        print("=== Django Configuration Validation ===")
        print(f"MEDIA_ROOT: {getattr(settings, 'MEDIA_ROOT', 'NOT SET')}")
        print(f"MEDIA_URL: {getattr(settings, 'MEDIA_URL', 'NOT SET')}")
        print(f"Storage backend: {default_storage.__class__.__name__}")
        print(f"Storage location: {getattr(default_storage, 'location', 'NOT SET')}")
        
        # Test storage accessibility
        if hasattr(default_storage, 'location') and default_storage.location:
            storage_accessible = os.path.exists(default_storage.location)
            storage_writable = os.access(default_storage.location, os.W_OK) if storage_accessible else False
            print(f"Storage accessible: {storage_accessible}")
            print(f"Storage writable: {storage_writable}")
            
            # Test exports directory
            exports_dir = os.path.join(default_storage.location, 'exports')
            print(f"Exports directory exists: {os.path.exists(exports_dir)}")
        
        print("=== End Django Validation ===")
        return True
        
    except Exception as e:
        print(f"❌ Django configuration validation failed: {e}")
        return False

# Auto-discover tasks in all installed apps
app.autodiscover_tasks()

# Validate Django configuration when Celery starts
validate_django_config()

@app.task(bind=True)
def debug_task(self):
    print(f'Request: {self.request!r}')

app.conf.beat_schedule = {
    'update-collection-item-counts': {
        'task': 'metadata.tasks.update_collection_item_counts',
        'schedule': crontab(hour=2, minute=0),  # Run at 2:00 AM every day
    },
    'check-pending-transcriptions': {
        'task': 'transcription.tasks.check_pending_transcriptions',
        'schedule': crontab(minute='*/15'),  # Run every 15 minutes
    },
    'sync-remote-files': {
        'task': 'metadata.tasks.sync_remote_files',
        'schedule': crontab(hour=3, minute=0),  # Run at 3:00 AM every day
    },
    'update-search-index': {
        'task': 'search.tasks.update_search_index',
        'schedule': crontab(hour=4, minute=0),  # Run at 4:00 AM every day
    },
    'cleanup-expired-sessions': {
        'task': 'accounts.tasks.cleanup_expired_sessions',
        'schedule': crontab(hour=1, minute=0, day_of_week=1),  # Run at 1:00 AM every Monday
    },
    'backup-database': {
        'task': 'archive.tasks.backup_database',
        'schedule': crontab(hour=0, minute=0),  # Run at midnight every day
    },
    # Add this new entry for the date range update task
    'update-collection-date-ranges': {
        'task': 'metadata.tasks.update_collection_date_ranges',
        'schedule': crontab(hour=2, minute=30),  # Run at 2:30 AM every day
    },
    'update-item-date-ranges': {
        'task': 'metadata.tasks.update_item_date_ranges',
        'schedule': crontab(hour=2, minute=15),  # Run at 2:15 AM every day
    },
} 