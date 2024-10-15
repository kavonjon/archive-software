import re, copy
from openpyxl import Workbook, load_workbook
from django.db.models import Count, Sum, Max, Q
from django.db import transaction
from metadata.models import Item, ItemTitle, Language, Dialect, DialectInstance, Collaborator, CollaboratorRole, Geographic, Columns_export, Document, Video, ACCESS_CHOICES, ACCESSION_CHOICES, AVAILABILITY_CHOICES, CONDITION_CHOICES, CONTENT_CHOICES, FORMAT_CHOICES, GENRE_CHOICES, MONTH_CHOICES, ROLE_CHOICES, LANGUAGE_DESCRIPTION_CHOICES, reverse_lookup_choices, validate_date_text
from metadata.views import is_valid_param
from django.core.management.base import BaseCommand

class Command(BaseCommand):
    def handle(self, **options):

        from metadata.models import Collection, Item

        # Build the collections map
        collections_map = {collection.name: collection.collection_abbr for collection in Collection.objects.all()}

        print("Collections map:")
        print(collections_map)

        # Find and print Item.collection_name values not in collections_map
        missing_collections = set()

        for item in Item.objects.all():
            if item.collection_name and item.collection_name not in collections_map:
                missing_collections.add(item.collection_name)

        print("\nCollection names in Items not found in Collections:")
        for name in sorted(missing_collections):
            print(name)

        print(f"\nTotal missing collections: {len(missing_collections)}")


        input("Press Enter to continue associating items with collections...")

        for item in Item.objects.all():
            if item.collection_name and item.collection_name in collections_map:
                item.collection_abbr = collections_map[item.collection_name]
                item.save()
                print(f"Updated item {item.id} with collection_abbr {item.collection_abbr}")

        print("All items updated.")

