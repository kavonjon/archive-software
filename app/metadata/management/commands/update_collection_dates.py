from django.core.management.base import BaseCommand
from metadata.tasks import update_collection_date_ranges
import time

class Command(BaseCommand):
    help = 'Updates date range fields for all collections'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("==== Collection Date Range Update ===="))
        self.stdout.write("Calculating date ranges based on items in each collection...")
        
        start_time = time.time()
        updated = update_collection_date_ranges()
        duration = time.time() - start_time
        
        self.stdout.write(self.style.SUCCESS(f"✓ Success! Updated {updated} collections"))
        self.stdout.write(f"Operation completed in {duration:.2f} seconds") 