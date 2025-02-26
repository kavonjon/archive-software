import re
from openpyxl import Workbook, load_workbook
from django.db.models import Count, Sum, Max, Q
from metadata.models import Item, Language, Dialect, DialectInstance, Collaborator, CollaboratorRole, Geographic, Columns_export, Document, Video, ACCESS_CHOICES, ACCESSION_CHOICES, AVAILABILITY_CHOICES, CONDITION_CHOICES, RESOURCE_TYPE_CHOICES, FORMAT_CHOICES, GENRE_CHOICES, MONTH_CHOICES, ROLE_CHOICES, reverse_lookup_choices, validate_date_text
from django.core.management.base import BaseCommand

class Command(BaseCommand):
    def handle(self, **options):
        # now do the things that you want with your models here


        # collections = ['car', 'bns', 'wdr']
        # for item in Item.objects.all():
        #     deleteit = True
        #     for collection in collections:
        #         if re.search(collection, item.catalog_number, flags=re.I):
        #             deleteit = False
        #     if deleteit:
        #         item.delete()
        #
        #
        # for collab in Collaborator.objects.all():
        #     if not len(collab.item_collaborators.all()):
        #         collab.delete()
        #
        #
        # for  lang in Language.objects.all():
        #     if not len(lang.item_languages.all()):
        #         lang.delete()
