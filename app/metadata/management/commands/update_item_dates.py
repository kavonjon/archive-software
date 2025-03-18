from django.core.management.base import BaseCommand
from metadata.tasks import update_item_date_ranges

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
            try:
                self.stdout.write("Scheduling item date range update task...")
                result = update_item_date_ranges.delay()
                self.stdout.write(self.style.SUCCESS(
                    f"Task scheduled with ID: {result.id}\n"
                    f"Check logs for results or use 'celery -A archive result {result.id}' to check status"
                ))
            except Exception as e:
                self.stdout.write(self.style.ERROR(
                    f"Failed to schedule async task: {str(e)}\n"
                    "Falling back to synchronous execution..."
                ))
                result = update_item_date_ranges()
                self.stdout.write(self.style.SUCCESS(
                    f"Update completed! Updated {result} items"
                ))
        else:
            self.stdout.write("Starting item date range update...")
            result = update_item_date_ranges()
            self.stdout.write(self.style.SUCCESS(
                f"Update completed! Updated {result} items"
            )) 