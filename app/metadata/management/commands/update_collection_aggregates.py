from django.core.management.base import BaseCommand

from metadata.tasks import update_collection_aggregates


class Command(BaseCommand):
    help = 'Recompute all derived collection aggregate fields'

    def handle(self, *args, **options):
        self.stdout.write('Starting collection aggregate update...')
        updated = update_collection_aggregates()
        self.stdout.write(self.style.SUCCESS(f'Successfully updated {updated} collections'))
