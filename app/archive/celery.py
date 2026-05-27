import os
from celery import Celery
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

# Let Django settings handle all Redis configuration
# Remove the custom Redis URL logic - Django settings will provide CELERY_BROKER_URL

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