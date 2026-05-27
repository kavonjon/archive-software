from django.core.management.base import BaseCommand

from metadata.tasks import update_collection_aggregates


class Command(BaseCommand):
    help = 'Generate aggregate values for collections based on their items'

    def handle(self, *args, **options):
        self.stdout.write('Recomputing collection aggregates from linked items...')
        updated = update_collection_aggregates()
        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully updated aggregates for {updated} collections'
            )
        )
