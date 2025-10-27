import re, csv, os
from openpyxl import Workbook, load_workbook
from django.db.models import Count, Sum, Max, Q
from metadata.models import Item, Languoid, Dialect, DialectInstance, Collaborator, CollaboratorRole, Geographic, Columns_export, Document, Video, ACCESS_CHOICES, ACCESSION_CHOICES, AVAILABILITY_CHOICES, CONDITION_CHOICES, RESOURCE_TYPE_CHOICES, FORMAT_CHOICES, GENRE_CHOICES, MONTH_CHOICES, ROLE_CHOICES, reverse_lookup_choices, validate_date_text
from django.core.management.base import BaseCommand
from django.core.files.storage import default_storage


class Command(BaseCommand):
    def handle(self, **options):

        # csv header
        fieldnames = ['name', 'glottocode', 'iso', 'alternative_names', 'family', 'subfamily', 'subsubfamily', 'dialects', 'region', 'notes']

        with default_storage.open('languoids.csv', 'w') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            for languoid in Languoid.objects.all():
                # csv data
                row = {
                    'name': languoid.name,
                    'glottocode': '',
                    'iso': languoid.iso,
                    'alternative_names': ', '.join(languoid.alt_names) if languoid.alt_names else '',
                    'family': languoid.family,
                    'subfamily': languoid.pri_subgroup,
                    'subsubfamily': languoid.sec_subgroup,
                    'dialects': "; ".join( languoid.language_dialects.values_list('name', flat=True).order_by('name') ),
                    'region': languoid.region,
                    'notes': languoid.notes
                    }
                writer.writerow(row)
