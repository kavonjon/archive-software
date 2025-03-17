import os
from celery import Celery
from celery.schedules import crontab

# Set the default Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'archive.settings')

app = Celery('archive')

# Use settings prefixed with CELERY_ in settings.py
app.config_from_object('django.conf:settings', namespace='CELERY')

# Ensure Redis password is included in broker URL
redis_password = os.environ.get('REDIS_PASSWORD')
redis_url = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
if redis_password and '://' in redis_url:
    protocol, rest = redis_url.split('://', 1)
    if '@' not in rest:
        host_part = rest
        app.conf.broker_url = f"{protocol}://:{redis_password}@{host_part}"
        app.conf.result_backend = app.conf.broker_url

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
} 