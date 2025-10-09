from rest_framework import serializers
from metadata.models import Item, Collection, Collaborator, Languoid, ItemTitle, CollaboratorRole


class ItemTitleSerializer(serializers.ModelSerializer):
    """Serializer for ItemTitle model"""
    class Meta:
        model = ItemTitle
        fields = ['id', 'title', 'title_type', 'language']


class ItemSerializer(serializers.ModelSerializer):
    """Internal API serializer for Item model with full field access"""
    titles = ItemTitleSerializer(many=True, read_only=True)
    collection_name = serializers.CharField(source='collection.name', read_only=True)
    
    class Meta:
        model = Item
        fields = [
            'id', 'uuid', 'slug', 'catalog_number', 'titles', 'collection', 'collection_name',
            'access_level', 'accession_type', 'availability', 'condition', 'resource_type',
            'format_type', 'genre', 'strict_genre', 'duration', 'creation_date_early',
            'creation_date_late', 'creation_date_is_approximate', 'creation_date_text',
            'creation_location', 'content_languages', 'collaborators', 'notes',
            'added', 'updated', 'modified_by'
        ]
        read_only_fields = ['id', 'uuid', 'slug', 'added', 'updated']


class CollectionSerializer(serializers.ModelSerializer):
    """Internal API serializer for Collection model"""
    item_count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Collection
        fields = [
            'id', 'uuid', 'slug', 'collection_abbr', 'name', 'extent', 'abstract',
            'access_levels', 'genres', 'languages', 'date_range', 'date_range_min',
            'date_range_max', 'item_count', 'added', 'updated', 'modified_by'
        ]
        read_only_fields = ['id', 'uuid', 'slug', 'item_count', 'added', 'updated']


class CollaboratorRoleSerializer(serializers.ModelSerializer):
    """Serializer for CollaboratorRole model"""
    class Meta:
        model = CollaboratorRole
        fields = ['id', 'role', 'notes', 'item', 'document']


class CollaboratorSerializer(serializers.ModelSerializer):
    """Internal API serializer for Collaborator model"""
    roles = CollaboratorRoleSerializer(many=True, read_only=True)
    
    class Meta:
        model = Collaborator
        fields = [
            'id', 'uuid', 'slug', 'last_name', 'first_name', 'middle_name', 'anonymous',
            'birth_date', 'death_date', 'gender', 'origin', 'tribal_affiliations',
            'native_languages', 'other_languages', 'roles', 'added', 'updated', 'modified_by'
        ]
        read_only_fields = ['id', 'uuid', 'slug', 'added', 'updated']


class LanguoidSerializer(serializers.ModelSerializer):
    """Internal API serializer for Languoid model"""
    
    class Meta:
        model = Languoid
        fields = [
            'id', 'iso', 'name', 'family', 'pri_subgroup', 'sec_subgroup',
            'alt_name', 'alt_names', 'region', 'notes', 'glottocode',
            'dialects_languoids', 'added', 'updated', 'modified_by'
        ]
        read_only_fields = ['id', 'added', 'updated']
