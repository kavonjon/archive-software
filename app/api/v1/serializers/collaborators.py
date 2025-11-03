from rest_framework import serializers
from metadata.models import Collaborator
from .languoids import SimpleLanguageSerializer

class CollaboratorListSerializer(serializers.ModelSerializer):
    """List serializer with basic collaborator information"""
    id = serializers.CharField(source='slug')
    name = serializers.SerializerMethodField()
    firstname = serializers.SerializerMethodField()
    lastname = serializers.SerializerMethodField()
    languages = serializers.SerializerMethodField()

    class Meta:
        model = Collaborator
        fields = ['id', 'name', 'firstname', 'lastname', 'languages']

    def get_name(self, obj):
        """Combine first and last name for display, or use 'Anonymous [slug]' if anonymous"""
        if obj.anonymous:
            return f"Anonymous {obj.slug}"
        if obj.first_names and obj.last_names:
            return f"{obj.first_names} {obj.last_names}"
        return obj.first_names or obj.last_names or obj.full_name

    def get_firstname(self, obj):
        """Return 'Anonymous' if anonymous, otherwise return firstname"""
        return 'Anonymous' if obj.anonymous else obj.first_names

    def get_lastname(self, obj):
        """Return slug if anonymous, otherwise return lastname"""
        return obj.slug if obj.anonymous else obj.last_names

    def get_languages(self, obj):
        """Combine native and other languages"""
        languages = list(obj.native_languages.all()) + list(obj.other_languages.all())
        return SimpleLanguageSerializer(languages, many=True).data

class CollaboratorDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer with full collaborator information"""
    id = serializers.CharField(source='slug')
    name = serializers.SerializerMethodField()
    firstname = serializers.SerializerMethodField()
    lastname = serializers.SerializerMethodField()
    native_languages = SimpleLanguageSerializer(many=True)
    other_languages = SimpleLanguageSerializer(many=True)
    nickname = serializers.SerializerMethodField()
    other_names = serializers.SerializerMethodField()
    clan_society = serializers.SerializerMethodField()
    tribal_affiliations = serializers.SerializerMethodField()
    origin = serializers.SerializerMethodField()
    birthdate = serializers.SerializerMethodField()
    deathdate = serializers.SerializerMethodField()
    gender = serializers.SerializerMethodField()
    other_info = serializers.SerializerMethodField()

    class Meta:
        model = Collaborator
        fields = [
            'id',
            'name',
            'firstname',
            'lastname',
            'nickname',
            'other_names',
            'anonymous',
            'native_languages',
            'other_languages',
            'clan_society',
            'tribal_affiliations',
            'origin',
            'birthdate',
            'deathdate',
            'gender',
            'other_info'
        ]

    def get_name(self, obj):
        """Combine first and last name for display, or use 'Anonymous [slug]' if anonymous"""
        if obj.anonymous:
            return f"Anonymous {obj.slug}"
        if obj.first_names and obj.last_names:
            return f"{obj.first_names} {obj.last_names}"
        return obj.first_names or obj.last_names or obj.full_name

    def get_firstname(self, obj):
        """Return 'Anonymous' if anonymous, otherwise return firstname"""
        return 'Anonymous' if obj.anonymous else obj.first_names

    def get_lastname(self, obj):
        """Return slug if anonymous, otherwise return lastname"""
        return obj.slug if obj.anonymous else obj.last_names

    def get_nickname(self, obj):
        """Return blank if anonymous, otherwise return nickname"""
        return '' if obj.anonymous else obj.nickname

    def get_other_names(self, obj):
        """Return blank if anonymous, otherwise return other_names"""
        return '' if obj.anonymous else obj.other_names

    def get_clan_society(self, obj):
        """Return blank if anonymous, otherwise return clan_society"""
        return '' if obj.anonymous else obj.clan_society

    def get_tribal_affiliations(self, obj):
        """Return blank if anonymous, otherwise return tribal_affiliations"""
        return '' if obj.anonymous else obj.tribal_affiliations

    def get_origin(self, obj):
        """Return blank if anonymous, otherwise return origin"""
        return '' if obj.anonymous else obj.origin

    def get_birthdate(self, obj):
        """Return blank if anonymous, otherwise return birthdate"""
        return '' if obj.anonymous else obj.birthdate

    def get_deathdate(self, obj):
        """Return blank if anonymous, otherwise return deathdate"""
        return '' if obj.anonymous else obj.deathdate

    def get_gender(self, obj):
        """Return blank if anonymous, otherwise return gender"""
        return '' if obj.anonymous else obj.gender

    def get_other_info(self, obj):
        """Return blank if anonymous, otherwise return other_info"""
        return '' if obj.anonymous else obj.other_info

class CollaboratorSerializer(serializers.ModelSerializer):
    """Serializer for collaborator information"""
    name = serializers.SerializerMethodField()
    roles = serializers.SerializerMethodField()
    citation_author = serializers.SerializerMethodField()

    class Meta:
        model = Collaborator
        fields = ['slug', 'firstname', 'lastname', 'name', 'roles', 'citation_author']

    def get_name(self, obj):
        """Combine first and last name for display"""
        if obj.first_names and obj.last_names:
            return f"{obj.first_names} {obj.last_names}"
        return obj.first_names or obj.last_names or obj.full_name

    def get_roles(self, obj):
        """Get roles for this collaborator on the current item"""
        item = self.context.get('item')
        if not item:
            return []
        
        role = obj.collaborator_collaboratorroles.filter(item=item).first()
        if not role:
            return []
            
        return CollaboratorRoleSerializer(role).data

    def get_citation_author(self, obj):
        """Get citation_author status for this collaborator on the current item"""
        item = self.context.get('item')
        if not item:
            return False
            
        role = obj.collaborator_collaboratorroles.filter(item=item).first()
        return role.citation_author if role else False 