from openpyxl import Workbook, load_workbook
from django.db.models import Count, Sum, Max, Q
from metadata.models import Item, Language, Dialect, DialectInstance, Collaborator, CollaboratorRole, Geographic, Columns_export, Document, Video, ACCESS_CHOICES, ACCESSION_CHOICES, AVAILABILITY_CHOICES, CONDITION_CHOICES, RESOURCE_TYPE_CHOICES, FORMAT_CHOICES, GENRE_CHOICES, MONTH_CHOICES, ROLE_CHOICES, reverse_lookup_choices, validate_date_text
from django.core.management.base import BaseCommand

class Command(BaseCommand):
    def add_arguments(self, parser):
        # Positional arguments
        parser.add_argument('itemid', nargs='+', type=int)

    def handle(self, **options):
        print(options['itemid'][0])
        collaborators = Item.objects.get(id=options['itemid'][0]).collaborator.all()
#        unique_collaborators = collaborators.distinct()
#        duplicate_collaborators = collaborators.difference(unique_collaborators)
        for collaborator in collaborators:
            roles = CollaboratorRole.objects.filter(item=options['itemid'][0], collaborator=collaborator).order_by('pk')
            if len(roles) > 1:
                for dup in roles[1:]:
                    if dup.role == roles[1].role:
                        print('Deleted: CollaboratorRole ' + str(dup.pk) + ', Item: ' + str(dup.item) + ', Collaborator: ' + str(dup.collaborator) + ', Roles: ' + str(dup.role))
                        dup.delete()
                    else:
                        print('REMAINS: CollaboratorRole ' + str(dup.pk) + ', Item: ' + str(dup.item) + ', Collaborator: ' + str(dup.collaborator) + ', Roles: ' + str(dup.role))
