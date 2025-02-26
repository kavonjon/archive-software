import re, copy
from openpyxl import Workbook, load_workbook
from django.db.models import Count, Sum, Max, Q
from django.db import transaction
from metadata.models import Item, ItemTitle, Language, Dialect, DialectInstance, Collaborator, CollaboratorRole, Geographic, Columns_export, Document, Video, ACCESS_CHOICES, ACCESSION_CHOICES, AVAILABILITY_CHOICES, CONDITION_CHOICES, RESOURCE_TYPE_CHOICES, FORMAT_CHOICES, GENRE_CHOICES, MONTH_CHOICES, ROLE_CHOICES, LANGUAGE_DESCRIPTION_CHOICES, reverse_lookup_choices, validate_date_text
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
                    # if new_value is in current_value, just remove old value
                    if new_value in current_value:
                        new_value_list = [value for value in current_value if value != old_value]
                    # if new_value is not in current_value, replace old value with new value
                    else:
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

        # rename_multiselect_value("language_description_type", "grammars", "grammar")
        # rename_multiselect_value("language_description_type", "dictionaries", "lexicon-dictionary")

        def move_value_across_multiselect_fields(old_field, new_field, old_value, new_value, old_text_field=False):
            num_items = Item.objects.filter(**{f'{old_field}__contains': old_value}).count()
            count = 0
            for item in Item.objects.filter(**{f'{old_field}__contains': old_value}):
                count += 1
                print(f"{count}/{num_items}")
                old_field_current_value = getattr(item, old_field)
                if isinstance(old_field_current_value, list) or old_text_field:
                    new_field_current_value = getattr(item, new_field)
                    if isinstance(new_field_current_value, list):
                        # check if old_value is in new_field_current_value
                        if new_value not in new_field_current_value:
                            # make a copy of new_field_current_value
                            new_field_new_value = copy.deepcopy(new_field_current_value)
                            # first remove new_value if it's in new_field but not the correct case
                            if new_value.lower() in (value.lower() for value in new_field_new_value):
                                new_field_new_value = [value for value in new_field_new_value if value.lower() != new_value.lower()]
                            # then add new_value
                            new_field_new_value.append(new_value)
                            # sort the list
                            new_field_new_value = ', '.join(sorted(new_field_new_value))
                        else:
                            new_field_new_value = ', '.join(list(new_field_current_value))

                        if old_text_field: # ASSUMES OLD_FIELD VALUES HAVE ONE TERM
                            old_field_new_value = ''
                            print('Item: ' + item.catalog_number + ' ' + old_field + ': ' + old_field_current_value + ' -> ' + old_field + ': ' + old_field_new_value)
                        else:
                            old_field_new_value_list = [value for value in old_field_current_value if value != old_value]
                            old_field_new_value = ', '.join(sorted(old_field_new_value_list))
                            print('Item: ' + item.catalog_number + ' ' + old_field + ': ' + ', '.join(old_field_current_value) + ' -> ' + old_field + ': ' + old_field_new_value)
                        
                        print('Item: ' + item.catalog_number + ' ' + new_field + ': ' + ', '.join(new_field_current_value) + ' -> ' + new_field + ': ' + new_field_new_value)
                        input()
                        setattr(item, new_field, new_field_new_value)
                        setattr(item, old_field, old_field_new_value)
                    else:
                        print('Error: may not be a multiple select field')
                        break
                else:
                    print('Error: may not be a multiple select field, and old_text_field is not set to True')
                    break
                try:
                    item.clean()
                    item.save()
                except:
                    print(item.catalog_number + " failed to move " + old_field + " text")
                    input("Press Enter to continue...")


        # move_value_across_multiselect_fields("genre", "language_description_type", "grammar", "grammar")

        # move_value_across_multiselect_fields("genre", "language_description_type", "field_notes", "fieldnotes")
        # move_value_across_multiselect_fields("genre", "language_description_type", "sketch", "grammar-sketch")
        # move_value_across_multiselect_fields("genre", "language_description_type", "lexicon", "lexicon")
        # move_value_across_multiselect_fields("genre", "language_description_type", "wordlist", "lexicon-wordlist")

        # move_value_across_multiselect_fields("music", "genre", "49", "49")
        # move_value_across_multiselect_fields("music", "genre", "children", "for_children")
        # move_value_across_multiselect_fields("music", "genre", "hand_game", "hand_game")
        # move_value_across_multiselect_fields("music", "genre", "hymns", "hymn")
        # move_value_across_multiselect_fields("music", "genre", "nac", "native_american_church")
        # move_value_across_multiselect_fields("music", "genre", "powwow", "powwow")
        # move_value_across_multiselect_fields("music", "genre", "round_dance", "round_dance")
        # move_value_across_multiselect_fields("music", "genre", "stomp_dance", "stomp_dance")
        # move_value_across_multiselect_fields("music", "genre", "sundance", "sundance")
        # move_value_across_multiselect_fields("music", "genre", "war_dance", "war_dance")
        # move_value_across_multiselect_fields("music", "genre", "ceremonial", "ceremonial")
        # rename_multiselect_value("genre", "song", "music")
        # rename_multiselect_value("genre", "reader", "textbook")
        # rename_multiselect_value("genre", "myth", "traditional_story")
        # rename_multiselect_value("genre", "procedure", "procedural")
        # rename_multiselect_value("genre", "proverb", "saying_proverb")
        # rename_multiselect_value("genre", "ceremony", "ceremonial")
        # rename_multiselect_value("genre", "ritual", "music")
        # rename_multiselect_value("genre", "recipe", "procedural")

        # {'', 'Teacher', 'Student', 'Family', 'Administrative'}
        # move_value_across_multiselect_fields("educational_materials_text", "genre", "Teacher", "educational_material_teachers",True)
        # move_value_across_multiselect_fields("educational_materials_text", "genre", "Student", "educational_material_learners",True)
        # move_value_across_multiselect_fields("educational_materials_text", "genre", "Family", "educational_material_family",True)
        # move_value_across_multiselect_fields("educational_materials_text", "genre", "Administrative", "educational_materials_planning",True)



        def remove_multiselect_value(field,old_value):
            num_items = Item.objects.filter(**{f'{field}__contains': old_value}).count()
            count = 0
            for item in Item.objects.filter(**{f'{field}__contains': old_value}):
                count += 1
                print(f"{count}/{num_items}")
                current_value = getattr(item, field)
                if isinstance(current_value, list):
                    new_value_list = [value for value in current_value if value != old_value]
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

        # remove_multiselect_value("genre", "chant")
        # remove_multiselect_value("genre", "curse")
        # remove_multiselect_value("genre", "debate")
        # remove_multiselect_value("genre", "description")
        # remove_multiselect_value("genre", "greeting")
        # remove_multiselect_value("genre", "instructions")
        # remove_multiselect_value("genre", "instrumental")
        # remove_multiselect_value("genre", "meeting")
        # remove_multiselect_value("genre", "Dispute")
        # remove_multiselect_value("genre", "dispute")


        def move_choices_value(field, old_value, new_value):
            num_items = Item.objects.filter(**{field: old_value}).count()
            count = 0
            for item in Item.objects.filter(**{field: old_value}):
                count += 1
                print(f"{count}/{num_items}")
                print('Item: ' + item.catalog_number + ' ' + field + ': ' + old_value + ' -> ' + new_value)
                input()
                setattr(item, field, new_value)
                try:
                    item.clean()
                    item.save()
                except:
                    print(item.catalog_number + " failed to move " + field + " text")
                    input("Press Enter to continue...")
        
        # move_choices_value("general_content", "book", "publication_book")


        # # Get all Language instances where glottocode is blank
        # languages = Language.objects.filter(glottocode='')
        # num_languages = languages.count()
        # # Start the enumeration from 9001
        # counter = 1
        # # Use a transaction to ensure data consistency
        # with transaction.atomic():
        #     for language in languages:
        #         # Assign the enumerated value to glottocode
        #         new_value = 'fake' + str(counter + 9000)
        #         language.glottocode = new_value
        #         print(str(counter) + '/' + str(num_languages))
        #         print('Language: ' + language.name + ' ' + 'glottocode: ""' + ' -> ' + new_value)
        #         input()
        #         language.save()
        #         # Increment the counter
        #         counter += 1
        
        # # Get all Language instances where level is not 'language'
        # languages = Language.objects.exclude(level='language')
        # num_languages = languages.count()
        # counter = 1

        # # Use a transaction to ensure data consistency
        # with transaction.atomic():
        #     for language in languages:
        #         # Change the level value to 'language'
        #         print(str(counter) + '/' + str(num_languages))
        #         print('Language: ' + language.name + ' ' + 'language: ' + language.level + ' -> ' + 'language')
        #         input()
        #         language.level = 'language'
        #         language.save()
        #         counter += 1


        # # make a function that gets every item's english title and makes an ItemTitle with title=that item's english title, item= that item, and language=english. Check first if there is already an ItemTitle for this before making a new one
        # def create_item_titles():
        #     counter = 0
        #     items = Item.objects.all()
        #     english_language = Language.objects.get(glottocode='stan1293')
        #     farsi_language = Language.objects.get(glottocode='west2369')
        #     with transaction.atomic():
        #         for item in items:
        #             if counter > 1000000:
        #                 break
        #             if item.english_title:
        #                 english_title = item.english_title
        #                 # Check if an ItemTitle already exists for this item and language
        #                 if not ItemTitle.objects.filter(item=item, language=english_language, title=english_title).exists():
        #                     # Create a new ItemTitle
        #                     item_title = ItemTitle(title=english_title, item=item, language=english_language)
        #                     print('Counter: ' + str(counter))
        #                     counter += 1
        #                     print('Item: ' + item.catalog_number + ' ' + 'English title: -> Title (English):' + english_title)
        #                     input()
        #                     item_title.save()
        #             if item.indigenous_title:
        #                 indigenous_title = item.indigenous_title
        #                 # Check if an ItemTitle already exists for this item and language
        #                 if not ItemTitle.objects.filter(item=item, language=farsi_language, title=indigenous_title).exists():
        #                     # Create a new ItemTitle
        #                     item_title = ItemTitle(title=indigenous_title, item=item, language=farsi_language)
        #                     print('Counter: ' + str(counter))
        #                     counter += 1
        #                     print('Item: ' + item.catalog_number + ' ' + 'Indigenous title: -> Title (Western Farsi):' + indigenous_title)
        #                     input()
        #                     item_title.save()
        # create_item_titles()
        
        # rename_multiselect_value("genre", "speech", "speech_play")
        # rename_multiselect_value("genre", "49", "music_forty_nine")
        # rename_multiselect_value("genre", "for_children", "music_for_children")
        # rename_multiselect_value("genre", "hand_game", "music_hand_game")
        # rename_multiselect_value("genre", "hymn", "music_hymn")
        # rename_multiselect_value("genre", "native_american_church", "music_native_american_church")
        # rename_multiselect_value("genre", "powwow", "music_powwow")
        # rename_multiselect_value("genre", "round_dance", "music_round_dance")
        # rename_multiselect_value("genre", "stomp_dance", "music_stomp_dance")
        # rename_multiselect_value("genre", "sundance", "music_sundance")
        # rename_multiselect_value("genre", "war_dance", "music_war_dance")

        # rename_multiselect_value("genre", "educational_materials_planning", "educational_material_planning")
