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

# Configure Celery worker settings
if platform.system() == 'Darwin':  # macOS
    # Use prefork pool on macOS to avoid fork issues
    app.conf.worker_pool = 'prefork'
    app.conf.worker_concurrency = int(os.environ.get('CELERY_WORKER_CONCURRENCY', 4))

# Auto-discover tasks in all installed apps
app.autodiscover_tasks()

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