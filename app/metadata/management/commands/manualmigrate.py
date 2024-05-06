import re
from openpyxl import Workbook, load_workbook
from django.db.models import Count, Sum, Max, Q
from metadata.models import Item, Language, Dialect, DialectInstance, Collaborator, CollaboratorRole, Geographic, Columns_export, Document, Video, ACCESS_CHOICES, ACCESSION_CHOICES, AVAILABILITY_CHOICES, CONDITION_CHOICES, CONTENT_CHOICES, FORMAT_CHOICES, GENRE_CHOICES, MONTH_CHOICES, ROLE_CHOICES, MUSIC_CHOICES, LANGUAGE_DESCRIPTION_CHOICES, reverse_lookup_choices, validate_date_text
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


        # for item in Item.objects.all():
        #     transfer_value("music", item.music_text, MUSIC_CHOICES)
        #     transfer_value("language_description_type", item.descriptive_materials_text, LANGUAGE_DESCRIPTION_CHOICES)

        def rename_multiselect_value(field, old_value, new_value):
            for item in Item.objects.filter(**{field: old_value}):
                setattr(item, field, new_value)
                try:
                    item.clean()
                    item.save()
                except:
                    print(item.catalog_number + " failed to move " + field + " text")
                    input("Press Enter to continue...")

        def rename_multiselect_value(field, old_value, new_value):
            num_items = Item.objects.filter(**{f'{field}__contains': old_value}).count()
            count = 0
            for item in Item.objects.filter(**{f'{field}__contains': old_value}):
                count += 1
                print(f"{count}/{num_items}")
                current_value = getattr(item, field)
                if isinstance(current_value, list):
                    new_value_list = [value.replace(old_value, new_value) for value in current_value]
                    new_value_str = ', '.join(new_value_list)
                    print('Item: ' + item.catalog_number + ' ' + field + ': ' + ', '.join(current_value) + ' -> ' + new_value_str)
                    input()
                    setattr(item, field, new_value_str)
                else:
                    print('Error: may not be a multiple select field')
                    break
                try:
                    item.clean()
                    item.save()
                except:
                    print(item.catalog_number + " failed to move " + field + " text")
                    input("Press Enter to continue...")

        rename_multiselect_value("language_description_type", "grammars", "grammar")
        rename_multiselect_value("language_description_type", "dictionaries", "lexicon-dictionary")