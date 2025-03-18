from django.core.management.base import BaseCommand
from metadata.tasks import update_item_date_ranges
from django.db.models import signals

class Command(BaseCommand):
    help = 'Updates min/max date fields for all items based on their text date fields'

    def add_arguments(self, parser):
        parser.add_argument(
            '--async',
            action='store_true',
            help='Run as asynchronous task (default: run synchronously)',
        )

    def handle(self, *args, **options):
        if options['async']:
            self.stdout.write("Scheduling item date range update task...")
            result = update_item_date_ranges.delay()
            self.stdout.write(self.style.SUCCESS(
                f"Task scheduled with ID: {result.id}\n"
                f"Check logs for results or use 'celery -A archive result {result.id}' to check status"
            ))
        else:
            self.stdout.write("Starting item date range update...")
            # Temporarily disconnect signals
            original_receivers = signals.post_save.receivers
            signals.post_save.receivers = []
            try:
                result = update_item_date_ranges()
                self.stdout.write(self.style.SUCCESS(
                    f"Update completed! Updated {result} items"
                ))
            finally:
                # Restore signals
                signals.post_save.receivers = original_receivers 