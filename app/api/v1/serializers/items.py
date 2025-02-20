from rest_framework import serializers
from metadata.models import Item
from drf_spectacular.utils import extend_schema_field
from typing import Optional

class ItemTitleSerializer(serializers.Serializer):
    """Serializer for item titles"""
    title = serializers.CharField()
    language = serializers.CharField(source='language.name')
    default = serializers.BooleanField()

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
    # ... other metadata fields

class ItemListSerializer(serializers.ModelSerializer):
    title = serializers.SerializerMethodField()

    class Meta:
        model = Item
        fields = [
            'id',
            'title',
            'catalog_number',
            'collection',
            'item_access_level',
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
            # ... other metadata fields
        }
