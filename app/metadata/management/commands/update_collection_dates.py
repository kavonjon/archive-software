from django.core.management.base import BaseCommand
from metadata.tasks import update_collection_date_ranges

class Command(BaseCommand):
    help = 'Updates date range fields for all collections'

    def handle(self, *args, **options):
        self.stdout.write("Starting collection date range update...")
        updated = update_collection_date_ranges()
        self.stdout.write(self.style.SUCCESS(f"Successfully updated {updated} collections")) 