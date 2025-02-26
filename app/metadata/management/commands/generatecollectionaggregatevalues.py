import re, copy
from openpyxl import Workbook, load_workbook
from django.db.models import Count, Sum, Max, Q
from django.db import transaction
from metadata.models import Item, ItemTitle, Language, Dialect, DialectInstance, Collaborator, CollaboratorRole, Geographic, Columns_export, Document, Video, ACCESS_CHOICES, ACCESSION_CHOICES, AVAILABILITY_CHOICES, CONDITION_CHOICES, RESOURCE_TYPE_CHOICES, FORMAT_CHOICES, GENRE_CHOICES, MONTH_CHOICES, ROLE_CHOICES, LANGUAGE_DESCRIPTION_CHOICES, reverse_lookup_choices, validate_date_text, Collection
from metadata.views import is_valid_param
from django.core.management.base import BaseCommand
from django.db.models import Min

class Command(BaseCommand):
    help = 'Generate aggregate values for collections based on their items'

        # in this command, we generate values for collections that are aggregations for items, or otherwise automated. these include languages, genres, access levels, date range, etc. This should be applied to all collections, for any of these values that are not set, we will generate a value based on the items in the collection.
    def handle(self, *args, **options):
        collections = Collection.objects.all()
        for collection in collections:
            self.stdout.write(f"Processing collection: {collection.collection_abbr}")
            
            # Get all items in the collection
            items = Item.objects.filter(collection=collection)
            if not items.exists():
                self.stdout.write(f"No items found in collection {collection.collection_abbr}")
                continue

            # Aggregate languages
            languages = set()
            for item in items:
                if item.language:
                    languages.update(item.language.all())
            if languages and not collection.languages.exists():
                collection.languages.set(languages)
                self.stdout.write(f"Added {len(languages)} languages to {collection.collection_abbr}")

            # Aggregate genres
            genres = set()
            for item in items:
                if item.genre:
                    genres.update(item.genre)
            if genres and not collection.genres:
                collection.genres = sorted(list(genres))
                self.stdout.write(f"Added {len(genres)} genres to {collection.collection_abbr}")

            # Aggregate access levels
            access_levels = set()
            for item in items:
                if item.item_access_level:
                    access_levels.add(item.item_access_level)
            # if access_levels and not collection.access_levels:
            if access_levels:
                # Sort and add all unique access levels found
                collection.access_levels = sorted(list(access_levels))
                self.stdout.write(f"Set access levels to {sorted(list(access_levels))} for {collection.collection_abbr}")

            # Aggregate date range
            date_range = items.aggregate(
                min_date=Min('creation_date_min'),
                max_date=Max('creation_date_max')
            )
            
            if date_range['min_date'] or date_range['max_date']:
                min_year = date_range['min_date'].year if date_range['min_date'] else None
                max_year = date_range['max_date'].year if date_range['max_date'] else None
                
                if min_year and max_year:
                    if min_year == max_year:
                        collection.date_range = str(min_year)
                    else:
                        collection.date_range = f"{min_year}-{max_year}"
                    self.stdout.write(f"Set date range {collection.date_range} for {collection.collection_abbr}")
                
            input()
            # Save all changes
            collection.save()

        self.stdout.write(self.style.SUCCESS('Successfully generated aggregate values for all collections'))