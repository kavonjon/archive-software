from rest_framework import serializers
from metadata.models import Collection, Languoid
from ..serializers.languoids import LanguoidListSerializer

# For list view - keep it minimal
class CollectionListSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='slug')
    abbr = serializers.CharField(source='collection_abbr')
    item_count = serializers.IntegerField(read_only=True)
    
    class Meta:
        model = Collection
        fields = ['id', 'abbr', 'name', 'item_count']

# For metadata in detail view
class CollectionDetailMetadataSerializer(serializers.Serializer):
    abstract = serializers.CharField(allow_blank=True)
    access_levels = serializers.SerializerMethodField()
    access_statement = serializers.CharField(allow_blank=True)
    acquisition = serializers.CharField(allow_blank=True)
    background = serializers.CharField(allow_blank=True)
    citation_authors = serializers.CharField(allow_blank=True)
    conventions = serializers.CharField(allow_blank=True)
    date_range = serializers.CharField(allow_blank=True)
    description = serializers.CharField(allow_blank=True)
    extent = serializers.CharField(allow_blank=True)
    genres = serializers.SerializerMethodField()
    item_count = serializers.IntegerField(read_only=True)
    
    def get_access_levels(self, obj):
        if not obj.access_levels:
            return []
        return [dict(Collection._meta.get_field('access_levels').choices)[level] for level in obj.access_levels]
    
    def get_genres(self, obj):
        if not obj.genres:
            return []
        return [dict(Collection._meta.get_field('genres').choices)[genre] for genre in obj.genres]

# For detail view - includes metadata
class CollectionDetailSerializer(serializers.ModelSerializer):
    id = serializers.CharField(source='slug')
    abbr = serializers.CharField(source='collection_abbr')
    metadata = CollectionDetailMetadataSerializer(source='*')
    languages = LanguoidListSerializer(many=True, read_only=True)
    
    class Meta:
        model = Collection
        fields = ['id', 'abbr', 'name', 'metadata', 'languages']

# Keep the original for backward compatibility if needed
CollectionSerializer = CollectionListSerializer 