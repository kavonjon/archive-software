import json
import os
from decimal import Decimal
from datetime import datetime, date
from django.core.management.base import BaseCommand
from django.core.serializers.json import DjangoJSONEncoder
from metadata.models import Languoid


class CustomJSONEncoder(DjangoJSONEncoder):
    """Custom JSON encoder to handle Decimal and other Django types"""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        return super().default(obj)


class Command(BaseCommand):
    help = 'Export all Languoid objects to a JSON file'

    def add_arguments(self, parser):
        parser.add_argument(
            '--output',
            type=str,
            default='languoids_export.json',
            help='Output filename (default: languoids_export.json)'
        )
        parser.add_argument(
            '--pretty',
            action='store_true',
            help='Pretty print JSON output with indentation'
        )

    def handle(self, *args, **options):
        output_filename = options['output']
        pretty = options['pretty']
        
        self.stdout.write(self.style.SUCCESS('Starting Languoid export...'))
        
        # Get all Languoid objects
        languoids = Languoid.objects.all()
        total_count = languoids.count()
        
        self.stdout.write(f'Found {total_count} Languoid objects')
        
        # Helper function to create a languoid reference object
        def get_languoid_ref(related_languoid):
            """Create a reference object with key fields from a related Languoid"""
            if not related_languoid:
                return None
            return {
                'id': related_languoid.id,
                'glottocode': related_languoid.glottocode,
                'iso': related_languoid.iso,
                'name': related_languoid.name,
            }
        
        # Build the export data
        export_data = []
        
        for languoid in languoids:
            # Build a dictionary with all fields
            languoid_dict = {
                'id': languoid.id,
                'glottocode': languoid.glottocode,
                'iso': languoid.iso,
                'name': languoid.name,
                'level': languoid.level_nal,
                'family': languoid.family,
                'family_id': languoid.family_id,
                'family_abbrev': languoid.family_abbrev,
                'family_languoid': get_languoid_ref(languoid.family_languoid),
                'pri_subgroup': languoid.pri_subgroup,
                'pri_subgroup_id': languoid.pri_subgroup_id,
                'pri_subgroup_abbrev': languoid.pri_subgroup_abbrev,
                'pri_subgroup_languoid': get_languoid_ref(languoid.pri_subgroup_languoid),
                'sec_subgroup': languoid.sec_subgroup,
                'sec_subgroup_id': languoid.sec_subgroup_id,
                'sec_subgroup_abbrev': languoid.sec_subgroup_abbrev,
                'sec_subgroup_languoid': get_languoid_ref(languoid.sec_subgroup_languoid),
                'parent_languoid': get_languoid_ref(languoid.parent_languoid),
                'alt_names': languoid.alt_names,
                'region': languoid.region,
                'longitude': float(languoid.longitude) if languoid.longitude else None,
                'latitude': float(languoid.latitude) if languoid.latitude else None,
                'tribes': languoid.tribes,
                'notes': languoid.notes,
                'added': languoid.added.isoformat() if languoid.added else None,
                'updated': languoid.updated.isoformat() if languoid.updated else None,
                'modified_by': languoid.modified_by,
                
                # Many-to-many relationships with full details
                'descendents': [
                    get_languoid_ref(desc) for desc in languoid.descendents.all()
                ],
            }
            
            export_data.append(languoid_dict)
        
        # Determine output path - save to current working directory
        # This makes it accessible when running in Docker with mounted volumes
        output_path = os.path.join(os.getcwd(), output_filename)
        
        # Write to JSON file
        with open(output_path, 'w', encoding='utf-8') as f:
            if pretty:
                json.dump(export_data, f, cls=CustomJSONEncoder, indent=2, ensure_ascii=False)
            else:
                json.dump(export_data, f, cls=CustomJSONEncoder, ensure_ascii=False)
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully exported {total_count} Languoid objects to {output_path}'
            )
        )
        self.stdout.write(f'File size: {os.path.getsize(output_path)} bytes')

