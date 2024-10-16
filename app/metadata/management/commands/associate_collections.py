import re, copy
from openpyxl import Workbook, load_workbook
from django.db.models import Count, Sum, Max, Q
from django.db import transaction
from metadata.models import Item, ItemTitle, Language, Dialect, DialectInstance, Collaborator, CollaboratorRole, Geographic, Columns_export, Document, Video, ACCESS_CHOICES, ACCESSION_CHOICES, AVAILABILITY_CHOICES, CONDITION_CHOICES, CONTENT_CHOICES, FORMAT_CHOICES, GENRE_CHOICES, MONTH_CHOICES, ROLE_CHOICES, LANGUAGE_DESCRIPTION_CHOICES, reverse_lookup_choices, validate_date_text, Collection
from metadata.views import is_valid_param
from django.core.management.base import BaseCommand

class Command(BaseCommand):
    def handle(self, **options):


        # Update the collection_name field in the Item model, changing instances of "and" to "&"
        for item in Item.objects.all():
            item.collection_name = item.collection_name.replace(" and ", " & ")
            print("Updated item", item.id, "with collection_name", item.collection_name)
            item.save()
            input()



        # Build the collections map
        collections_map = {
            f"{collection.collection_abbr} ({collection.name})": collection.collection_abbr 
            for collection in Collection.objects.all() 
            if collection.collection_abbr and len(collection.collection_abbr) == 3
        }

        print("Collections map:")
        for collection in collections_map:
            print(collection)

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
                collection_abbr = collections_map[item.collection_name]
                try:
                    collection = Collection.objects.get(collection_abbr=collection_abbr)
                    item.collection = collection
                    item.save()
                except Collection.DoesNotExist:
                    print(f"No Collection found with abbreviation: {collection_abbr} for item: {item.id}")
            else:
                print(f"No matching collection found for item: {item.id} with collection_name: {item.collection_name}")
            print(f"Updated item {item.id} with collection_abbr {item.collection_abbr}")
            input()

        print("All items updated.")
