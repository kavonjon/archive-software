import os
from celery import Celery

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