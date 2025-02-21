from rest_framework import serializers
from metadata.models import Language

class LanguageListMetadataSerializer(serializers.Serializer):
    """Serializer for language metadata fields in list view"""
    family_id = serializers.CharField(allow_blank=True)
    family_abbrev = serializers.CharField(allow_blank=True)
    family_languoid = serializers.CharField(allow_blank=True)
    pri_subgroup_id = serializers.CharField(allow_blank=True)
    pri_subgroup_abbrev = serializers.CharField(allow_blank=True)
    pri_subgroup_languoid = serializers.CharField(allow_blank=True)
    sec_subgroup_id = serializers.CharField(allow_blank=True)

class LanguageDetailMetadataSerializer(serializers.Serializer):
    """Serializer for language metadata fields in detail view"""
    iso = serializers.CharField(allow_blank=True)
    level = serializers.CharField(allow_blank=True)
    family = serializers.CharField(allow_blank=True)
    family_id = serializers.CharField(allow_blank=True)
    family_abbrev = serializers.CharField(allow_blank=True)
    family_languoid = serializers.CharField(allow_blank=True)
    pri_subgroup = serializers.CharField(allow_blank=True)
    pri_subgroup_id = serializers.CharField(allow_blank=True)
    pri_subgroup_abbrev = serializers.CharField(allow_blank=True)
    pri_subgroup_languoid = serializers.CharField(allow_blank=True)
    sec_subgroup = serializers.CharField(allow_blank=True)
    sec_subgroup_id = serializers.CharField(allow_blank=True)

class LanguoidListSerializer(serializers.ModelSerializer):
    """List serializer with basic metadata"""
    metadata = LanguageListMetadataSerializer(source='*')

    class Meta:
        model = Language
        fields = [
            'id',
            'name',
            'glottocode',
            'metadata',
        ]

class LanguoidDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer with full metadata"""
    metadata = LanguageDetailMetadataSerializer(source='*')

    class Meta:
        model = Language
        fields = [
            'id',
            'name',
            'glottocode',
            'metadata',
        ] 