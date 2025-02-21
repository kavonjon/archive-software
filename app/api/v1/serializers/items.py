from rest_framework import serializers
from metadata.models import Item, GENRE_CHOICES
from drf_spectacular.utils import extend_schema_field
from typing import Optional

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
    # ... other metadata fields

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
    """Simple serializer for language information"""
    id = serializers.IntegerField()
    name = serializers.CharField()

# First, let's create a simplified metadata serializer for the list view
class ItemListMetadataSerializer(serializers.Serializer):
    """Serializer for subset of item metadata in list view"""
    catalog_number = serializers.CharField()
    collection = serializers.SerializerMethodField()
    item_access_level = serializers.CharField()
    resource_type = serializers.CharField(allow_blank=True)
    accession_date = serializers.DateField(allow_null=True)
    all_languages = serializers.SerializerMethodField()
    genres = serializers.SerializerMethodField()
    description = serializers.CharField(source='description_scope_and_content', allow_blank=True)

    def get_collection(self, obj) -> Optional[int]:
        return obj.collection.id if obj.collection else None

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
    title = serializers.SerializerMethodField()
    metadata = ItemListMetadataSerializer(source='*')

    class Meta:
        model = Item
        fields = [
            'id',
            'title',
            'metadata',
        ]

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_title(self, obj) -> Optional[str]:
        default_title = obj.title_item.filter(default=True).first()
        if default_title:
            return default_title.title
        return None

class ItemDetailSerializer(serializers.ModelSerializer):
    metadata = ItemMetadataSerializer(source='*')
    titles = ItemTitleSerializer(source='title_item', many=True)
    title = serializers.SerializerMethodField()

    class Meta:
        model = Item
        fields = [
            'id',
            'title',
            'metadata',
            'titles',
        ]

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_title(self, obj) -> Optional[str]:
        default_title = obj.title_item.filter(default=True).first()
        if default_title:
            return default_title.title
        return None

    def get_metadata(self, obj):
        return {
            'catalog_number': obj.catalog_number,
            'collection': obj.collection.id if obj.collection else None,
            'item_access_level': obj.item_access_level,
            'access_level_restrictions': obj.access_level_restrictions,
            'accession_date': obj.accession_date,
            'accession_number': obj.accession_number,
            'acquisition_notes': obj.acquisition_notes,
            'associated_ephemera': obj.associated_ephemera,
            'availability_status': obj.availability_status,
            'resource_type': obj.resource_type,
            'all_languages': SimpleLanguageSerializer(obj.language.all(), many=True).data,
            'genres': self.get_genres(obj),
            'call_number': obj.call_number,
            'copyrighted_notes': obj.copyrighted_notes,
            'description': obj.description_scope_and_content,
            # ... other metadata fields
        }
