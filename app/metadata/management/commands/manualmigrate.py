import re
from openpyxl import Workbook, load_workbook
from django.db.models import Count, Sum, Max, Q
from metadata.models import Item, Language, Dialect, DialectInstance, Collaborator, CollaboratorRole, Geographic, Columns_export, Document, Video, ACCESS_CHOICES, ACCESSION_CHOICES, AVAILABILITY_CHOICES, CONDITION_CHOICES, CONTENT_CHOICES, FORMAT_CHOICES, GENRE_CHOICES, MONTH_CHOICES, ROLE_CHOICES, MUSIC_CHOICES, DESCRIPTIVE_MATERIALS_CHOICES, reverse_lookup_choices, validate_date_text
from metadata.views import is_valid_param
from django.core.management.base import BaseCommand

class Command(BaseCommand):
    def handle(self, **options):
        # now do the things that you want with your models here


        def transfer_value(field, value, choices):
            if is_valid_param(value):
                value = reverse_lookup_choices(choices, value)
                value = re.sub(r"\n", r", ", value)
                value = re.sub(r"[,\s]*$", r"", value)
                setattr(item, field, value)
                try:
                    item.clean()
                    item.save()
                except:
                    print(item.catalog_number + " failed to move " + field + " text")
                    input("Press Enter to continue...")


        for item in Item.objects.all():
            transfer_value("music", item.music_text, MUSIC_CHOICES)
            transfer_value("descriptive_materials", item.descriptive_materials_text, DESCRIPTIVE_MATERIALS_CHOICES)
