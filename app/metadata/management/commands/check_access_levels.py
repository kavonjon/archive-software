from django.core.management.base import BaseCommand, CommandError
from metadata.models import Item, ACCESS_CHOICES
from collections import Counter

class Command(BaseCommand):
    help = 'Check access levels for items with catalog numbers starting with a specific prefix'

    def add_arguments(self, parser):
        parser.add_argument('prefix', type=str, help='Catalog number prefix to check (e.g. "ABC")')

    def handle(self, *args, **options):
        prefix = options['prefix']
        self.stdout.write(f"Checking access levels for items with catalog numbers starting with '{prefix}'...")
        
        # Query for matching items
        items = Item.objects.filter(catalog_number__startswith=prefix)
        
        if not items.exists():
            self.stdout.write(self.style.WARNING(f"No items found with catalog numbers beginning with '{prefix}'."))
            return
        
        self.stdout.write(f"Found {items.count()} items with catalog numbers beginning with '{prefix}':")
        self.stdout.write("-" * 70)
        self.stdout.write(f"{'CATALOG NUMBER':<20} {'ACCESS LEVEL':<15} {'ACCESS LEVEL NAME':<35}")
        self.stdout.write("-" * 70)
        
        # Dictionary to map access level codes to their names
        access_level_map = dict(ACCESS_CHOICES)
        
        # Counter for access levels
        access_level_counts = Counter()
        
        for item in items:
            access_level = item.item_access_level
            if access_level:
                access_level_name = access_level_map.get(access_level, 'Unknown')
                access_level_counts[access_level] += 1
            else:
                access_level_name = 'Not set'
                access_level_counts['None'] += 1
            
            self.stdout.write(f"{item.catalog_number:<20} {access_level or 'None':<15} {access_level_name:<35}")

        # Summary
        items_with_access = items.exclude(item_access_level='').exclude(item_access_level__isnull=True)
        self.stdout.write("-" * 70)
        self.stdout.write(
            self.style.SUCCESS(
                f"Summary: {items_with_access.count()} out of {items.count()} '{prefix}' items have access levels set."
            )
        )
        
        # Detailed counts by access level
        self.stdout.write("\nAccess level distribution:")
        self.stdout.write("-" * 70)
        self.stdout.write(f"{'ACCESS LEVEL':<15} {'COUNT':<10} {'DESCRIPTION':<45}")
        self.stdout.write("-" * 70)
        
        for level, count in sorted(access_level_counts.items()):
            if level == 'None':
                description = 'Not set'
            else:
                description = access_level_map.get(level, 'Unknown')
            
            self.stdout.write(f"{level:<15} {count:<10} {description:<45}")
        
        self.stdout.write("-" * 70) 