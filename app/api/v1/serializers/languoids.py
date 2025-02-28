from rest_framework import serializers
from metadata.models import Languoid

class LanguoidListMetadataSerializer(serializers.Serializer):
    """Serializer for languoid metadata fields in list view"""
    family_id = serializers.CharField(allow_blank=True)
    family_abbrev = serializers.CharField(allow_blank=True)
    family_languoid = serializers.CharField(allow_blank=True)
    pri_subgroup_id = serializers.CharField(allow_blank=True)
    pri_subgroup_abbrev = serializers.CharField(allow_blank=True)
    pri_subgroup_languoid = serializers.CharField(allow_blank=True)
    sec_subgroup_id = serializers.CharField(allow_blank=True)
    sec_subgroup_abbrev = serializers.CharField(allow_blank=True)
    sec_subgroup_languoid = serializers.CharField(allow_blank=True)

class LanguoidDetailMetadataSerializer(serializers.Serializer):
    """Serializer for languoid metadata fields in detail view"""
    glottocode = serializers.CharField(allow_blank=True)
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
    sec_subgroup_abbrev = serializers.CharField(allow_blank=True)
    sec_subgroup_languoid = serializers.CharField(allow_blank=True)
    # alt_name = serializers.CharField(allow_blank=True)
    region = serializers.CharField(allow_blank=True)

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