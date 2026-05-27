import time

from django.core.management.base import BaseCommand

from metadata.tasks import update_collection_aggregates


class Command(BaseCommand):
    help = 'Updates derived collection aggregates (deprecated wrapper; use update_collection_aggregates)'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('==== Collection Aggregate Update ===='))
        start_time = time.time()
        updated = update_collection_aggregates()
        duration = time.time() - start_time
        self.stdout.write(self.style.SUCCESS(f'Updated {updated} collections in {duration:.2f} seconds'))
