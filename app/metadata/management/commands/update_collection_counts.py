from django.core.management.base import BaseCommand
from metadata.tasks import update_collection_item_counts

class Command(BaseCommand):
    help = 'Updates item counts for all collections'

    def handle(self, *args, **options):
        self.stdout.write("Starting collection item count update...")
        updated = update_collection_item_counts()
        self.stdout.write(self.style.SUCCESS(f"Successfully updated {updated} collections")) 