from rest_framework import serializers
from metadata.models import Languoid

class SimpleLanguageSerializer(serializers.ModelSerializer):
    """Simple serializer for languoid information"""
    id = serializers.CharField(source='glottocode')
    name = serializers.CharField()

    class Meta:
        model = Languoid
        fields = ['id', 'name']

class LanguoidListMetadataSerializer(serializers.Serializer):
    """Serializer for languoid metadata fields in list view"""
    family_languoid = serializers.CharField(allow_blank=True)
    pri_subgroup_languoid = serializers.CharField(allow_blank=True)
    sec_subgroup_languoid = serializers.CharField(allow_blank=True)

class LanguoidDetailMetadataSerializer(serializers.Serializer):
    """Serializer for languoid metadata fields in detail view"""
    glottocode = serializers.CharField(allow_blank=True)
    iso = serializers.CharField(allow_blank=True)
    level = serializers.CharField(allow_blank=True)
    family_languoid = serializers.CharField(allow_blank=True)
    pri_subgroup_languoid = serializers.CharField(allow_blank=True)
    sec_subgroup_languoid = serializers.CharField(allow_blank=True)
    alternative_names = serializers.SerializerMethodField()
    region = serializers.CharField(allow_blank=True)

    def get_alternative_names(self, obj):
        """Return alt_names list directly"""
        return obj.alt_names if obj.alt_names else []

class LanguoidListSerializer(serializers.ModelSerializer):
    """List serializer with basic metadata"""
    metadata = LanguoidListMetadataSerializer(source='*')
    id = serializers.CharField(source='glottocode')
    title = serializers.CharField(source='name')

    class Meta:
        model = Languoid
        fields = [
            'id',
            'title',
            'metadata',
        ]

class LanguoidDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer with full metadata"""
    metadata = LanguoidDetailMetadataSerializer(source='*')
    id = serializers.CharField(source='glottocode')
    title = serializers.CharField(source='name')

    class Meta:
        model = Languoid
        fields = [
            'id',
            'title',
            'metadata',
        ] 