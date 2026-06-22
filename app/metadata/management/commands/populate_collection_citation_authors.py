from django.core.management.base import BaseCommand, CommandError

from metadata.models import Collection
from metadata.services.collection_citation_authors import apply_citation_authors_to_collection


class Command(BaseCommand):
    help = (
        'One-time backfill: set each collection citation_authors M2M from item '
        'collaborators with citation_author=True (FK-linked items only).'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--abbrev',
            dest='abbrev',
            type=str,
            help='Collection abbreviation to update only one collection (e.g. ACH)',
        )

    def handle(self, *args, **options):
        abbrev = options.get('abbrev')

        if abbrev:
            try:
                collections = [Collection.objects.get(collection_abbr=abbrev)]
            except Collection.DoesNotExist as exc:
                raise CommandError(f'Collection with abbreviation "{abbrev}" not found') from exc
        else:
            collections = Collection.objects.all().order_by('collection_abbr')

        if not collections:
            self.stdout.write('No collections found.')
            return

        for collection in collections:
            count = apply_citation_authors_to_collection(collection)
            self.stdout.write(
                f'{collection.collection_abbr}: set {count} citation author(s)'
            )

        self.stdout.write(
            self.style.SUCCESS(f'Updated {len(collections)} collection(s)')
        )
