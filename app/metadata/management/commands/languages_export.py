import re, csv, os
from openpyxl import Workbook, load_workbook
from django.db.models import Count, Sum, Max, Q
from metadata.models import Item, Language, Dialect, DialectInstance, Collaborator, CollaboratorRole, Geographic, Columns_export, Document, Video, ACCESS_CHOICES, ACCESSION_CHOICES, AVAILABILITY_CHOICES, CONDITION_CHOICES, RESOURCE_TYPE_CHOICES, FORMAT_CHOICES, GENRE_CHOICES, MONTH_CHOICES, ROLE_CHOICES, reverse_lookup_choices, validate_date_text
from django.core.management.base import BaseCommand
from django.core.files.storage import default_storage


class Command(BaseCommand):
    def handle(self, **options):

        # csv header
        fieldnames = ['name', 'glottocode', 'iso', 'alternative_names', 'family', 'subfamily', 'subsubfamily', 'dialects', 'region', 'notes']

        with default_storage.open('languages.csv', 'w') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            for language in Language.objects.all():
                # csv data
                row = {
                    'name': language.name,
                    'glottocode': '',
                    'iso': language.iso,
                    'alternative_names': language.alt_name,
                    'family': language.family,
                    'subfamily': language.pri_subgroup,
                    'subsubfamily': language.sec_subgroup,
                    'dialects': "; ".join( language.language_dialects.values_list('name', flat=True).order_by('name') ),
                    'region': language.region,
                    'notes': language.notes
                    }
                writer.writerow(row)
