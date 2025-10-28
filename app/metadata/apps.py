from django.apps import AppConfig


class MetadataConfig(AppConfig):
    name = 'metadata'

    def ready(self):
        # Import signals to register them
        import metadata.signals
        
        # Warm languoid list cache on Django startup
        # This ensures the cache is ready before the first user visits
        # The task runs async in Celery, so it doesn't block Django startup
        import logging
        logger = logging.getLogger(__name__)
        
        try:
            from .tasks import warm_languoid_list_cache
            
            # Trigger cache warming task (high priority)
            # This will complete in ~22 seconds in the background
            warm_languoid_list_cache.apply_async(priority=9)
            logger.info("[Startup] Languoid list cache warming task triggered")
        except Exception as e:
            # Don't crash Django if cache warming fails
            logger.warning(f"[Startup] Failed to trigger cache warming: {e}")