from django.apps import AppConfig


class MetadataConfig(AppConfig):
    name = 'metadata'

    def ready(self):
        import metadata.signals