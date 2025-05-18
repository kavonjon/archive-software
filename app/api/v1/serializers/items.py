from rest_framework import serializers
from metadata.models import Item, GENRE_CHOICES, Collection
from drf_spectacular.utils import extend_schema_field
from typing import Optional
from .collaborator_roles import ItemCollaboratorSerializer

class ItemTitleSerializer(serializers.Serializer):
    """Serializer for item titles"""
    title = serializers.CharField()
    language = serializers.CharField(source='language.name')
    default = serializers.BooleanField()

class GenreSerializer(serializers.Serializer):
    """Simple serializer for genre information"""
    id = serializers.CharField()  # This will be the choice value
    title = serializers.CharField()  # Changed from 'name' to 'title'

class ItemMetadataSerializer(serializers.Serializer):
    catalog_number = serializers.CharField()
    collection = serializers.IntegerField(allow_null=True)
    item_access_level = serializers.CharField()
    access_level_restrictions = serializers.CharField(allow_blank=True)
    accession_date = serializers.DateField(allow_null=True)
    accession_number = serializers.CharField(allow_blank=True)
    acquisition_notes = serializers.CharField(allow_blank=True)
    associated_ephemera = serializers.CharField(allow_blank=True)
    availability_status = serializers.CharField(allow_blank=True)
    resource_type = serializers.CharField(allow_blank=True)
    all_languages = serializers.SerializerMethodField()
    genres = serializers.SerializerMethodField()
    description = serializers.CharField(source='description_scope_and_content', allow_blank=True)
    call_number = serializers.CharField(allow_blank=True)
    copyrighted_notes = serializers.CharField(allow_blank=True)

    def get_all_languages(self, obj):
        return SimpleLanguageSerializer(obj.language.all(), many=True).data

    def get_genres(self, obj):
        # Convert genre choices to id/title format
        genres = []
        for genre_value in obj.genre:
            # Find matching choice tuple
            for choice_value, choice_label in GENRE_CHOICES:
                if choice_value == genre_value:
                    genres.append({
                        'id': choice_value,
                        'title': choice_label  # Changed from 'name' to 'title'
                    })
                    break
        return genres

class SimpleLanguageSerializer(serializers.Serializer):
    """Simple serializer for languoid information"""
    id = serializers.IntegerField()
    name = serializers.CharField()

class CollectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Collection
        fields = ['id', 'name', 'collection_abbr']

class ItemListMetadataSerializer(serializers.Serializer):
    """Serializer for item metadata fields in list view"""
    catalog_number = serializers.CharField()
    item_access_level = serializers.CharField()
    resource_type = serializers.CharField(allow_blank=True)
    accession_date = serializers.DateField(allow_null=True)
    all_languages = serializers.SerializerMethodField()
    genres = serializers.SerializerMethodField()
    description = serializers.CharField(source='description_scope_and_content', allow_blank=True)

    def get_all_languages(self, obj):
        return SimpleLanguageSerializer(obj.language.all(), many=True).data

    def get_genres(self, obj):
        # Convert genre choices to id/title format
        genres = []
        for genre_value in obj.genre:
            # Find matching choice tuple
            for choice_value, choice_label in GENRE_CHOICES:
                if choice_value == genre_value:
                    genres.append({
                        'id': choice_value,
                        'title': choice_label  # Changed from 'name' to 'title'
                    })
                    break
        return genres

class ItemListSerializer(serializers.ModelSerializer):
    """List serializer with basic metadata"""
    metadata = ItemListMetadataSerializer(source='*')
    collection = CollectionSerializer(read_only=True)
    id = serializers.CharField(source='slug')

    class Meta:
        model = Item
        fields = [
            'id',
            'collection',
            'metadata',
        ]

class ItemDetailMetadataSerializer(serializers.Serializer):
    """Serializer for item metadata fields in detail view"""
    access_level_restrictions = serializers.CharField(allow_blank=True)
    accession_date = serializers.DateField(allow_null=True)
    accession_number = serializers.CharField(allow_blank=True)
    acquisition_notes = serializers.CharField(allow_blank=True)
    associated_ephemera = serializers.CharField(allow_blank=True)
    availability_status = serializers.CharField(allow_blank=True)
    availability_status_notes = serializers.CharField(allow_blank=True)
    call_number = serializers.CharField(allow_blank=True)
    catalog_number = serializers.CharField()
    cataloged_date = serializers.DateField(allow_null=True)
    collaborators = serializers.SerializerMethodField()
    collecting_notes = serializers.CharField(allow_blank=True)
    collection_date = serializers.DateField(allow_null=True)
    condition_notes = serializers.CharField(allow_blank=True)
    conservation_treatments_performed = serializers.CharField(allow_blank=True)
    copyrighted_notes = serializers.CharField(allow_blank=True)
    creation_date = serializers.DateField(allow_null=True)
    description = serializers.CharField(source='description_scope_and_content', allow_blank=True)
    equipment_used = serializers.CharField(allow_blank=True)
    genres = serializers.SerializerMethodField()
    isbn = serializers.CharField(allow_blank=True)
    item_access_level = serializers.CharField()
    lender_loan_number = serializers.CharField(allow_blank=True)
    loc_catalog_number = serializers.CharField(allow_blank=True)
    location_of_original = serializers.CharField(allow_blank=True)
    migration_file_format = serializers.CharField(allow_blank=True)
    original_format_medium = serializers.CharField(allow_blank=True)
    other_information = serializers.CharField(allow_blank=True)
    project_grant = serializers.CharField(allow_blank=True)
    public_event = serializers.BooleanField(allow_null=True)
    publisher = serializers.CharField(allow_blank=True)
    recorded_on = serializers.DateField(allow_null=True)
    recording_context = serializers.CharField(allow_blank=True)
    resource_type = serializers.CharField(allow_blank=True)
    software_used = serializers.CharField(allow_blank=True)
    total_number_of_pages_and_physical_description = serializers.CharField(allow_blank=True)
    type_of_accession = serializers.CharField(allow_blank=True)


    def get_all_languages(self, obj):
        return SimpleLanguageSerializer(obj.language.all(), many=True).data

    def get_genres(self, obj):
        # Convert genre choices to id/title format
        genres = []
        for genre_value in obj.genre:
            # Find matching choice tuple
            for choice_value, choice_label in GENRE_CHOICES:
                if choice_value == genre_value:
                    genres.append({
                        'id': choice_value,
                        'title': choice_label
                    })
                    break
        return genres

    def get_collaborators(self, obj):
        """Get collaborators for this item"""
        return ItemCollaboratorSerializer(
            obj.collaborator.all(),
            many=True,
            context={'item': obj}
        ).data

class ItemDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer with full metadata"""
    metadata = ItemDetailMetadataSerializer(source='*')
    collection = CollectionSerializer(read_only=True)
    titles = ItemTitleSerializer(source='title_item', many=True)
    title = serializers.SerializerMethodField()
    files = serializers.SerializerMethodField()
    id = serializers.CharField(source='slug')

    class Meta:
        model = Item
        fields = [
            'id',
            'collection',
            'metadata',
            'titles',
            'title',
            'files',
        ]

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_title(self, obj) -> Optional[str]:
        default_title = obj.title_item.filter(default=True).first()
        if default_title:
            return default_title.title
        return None

    @extend_schema_field(serializers.DictField(allow_null=True))
    def get_files(self, obj):
        """Get file information for the item"""
        # Get all File objects associated with this item
        file_objects = obj.item_files.all()
        
        if not file_objects:
            return None
            
        # Calculate total size
        total_bytes = 0
        for file_obj in file_objects:
            total_bytes += file_obj.filesize or 0
            
        # Build entries dictionary
        entries = {}
        for file_obj in file_objects:
            entries[file_obj.filename] = {
                'id': str(file_obj.uuid),
                'checksum': file_obj.checksum,
                'ext': file_obj.get_extension(),
                'size': file_obj.filesize,
                'mimetype': file_obj.mimetype,
                'key': file_obj.filename,
                'metadata': file_obj.get_metadata_dict()
            }
            
        # Return the files data in the requested format
        return {
            'count': len(file_objects),
            'total_bytes': total_bytes,
            'entries': entries
        }

    def get_metadata(self, obj):
        return {
            'access_level_restrictions': obj.access_level_restrictions,
            'accession_date': obj.accession_date,
            'accession_number': obj.accession_number,
            'acquisition_notes': obj.acquisition_notes,
            'all_languages': SimpleLanguageSerializer(obj.language.all(), many=True).data,
            'associated_ephemera': obj.associated_ephemera,
            'availability_status': obj.availability_status,
            'availability_status_notes': obj.availability_status_notes,
            'call_number': obj.call_number,
            'catalog_number': obj.catalog_number,
            'cataloged_date': obj.cataloged_date,
            'collaborators': self.metadata.get_collaborators(obj),
            'collecting_notes': obj.collecting_notes,
            'collection_date': obj.collection_date,
            'condition_notes': obj.condition_notes,
            'conservation_treatments_performed': obj.conservation_treatments_performed,
            'copyrighted_notes': obj.copyrighted_notes,
            'creation_date': obj.creation_date,
            'description': obj.description_scope_and_content,
            'equipment_used': obj.equipment_used,
            'genres': self.get_genres(obj),
            'isbn': obj.isbn,
            'item_access_level': obj.item_access_level,
            'lender_loan_number': obj.lender_loan_number,
            'loc_catalog_number': obj.loc_catalog_number,
            'location_of_original': obj.location_of_original,
            'migration_file_format': obj.migration_file_format,
            'original_format_medium': obj.original_format_medium,
            'other_information': obj.other_information,
            'project_grant': obj.project_grant,
            'public_event': obj.public_event,
            'publisher': obj.publisher,
            'recorded_on': obj.recorded_on,
            'recording_context': obj.recording_context,
            'resource_type': obj.resource_type,
            'software_used': obj.software_used,
            'total_number_of_pages_and_physical_description': obj.total_number_of_pages_and_physical_description,
            'type_of_accession': obj.type_of_accession
        }
