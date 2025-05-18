from rest_framework import serializers
from metadata.models import Collaborator, CollaboratorRole, ROLE_CHOICES

class CollaboratorRoleSerializer(serializers.ModelSerializer):
    """Serializer for collaborator roles"""
    roles = serializers.SerializerMethodField()

    class Meta:
        model = CollaboratorRole
        fields = ['roles']

    def get_roles(self, obj):
        """Convert role choices to a list of id/title objects"""
        if not obj.role:
            return []
        roles = []
        for role_value in obj.role:
            for choice_value, choice_label in ROLE_CHOICES:
                if choice_value == role_value:
                    roles.append({
                        'id': choice_value,
                        'title': choice_label
                    })
                    break
        return roles

class ItemCollaboratorSerializer(serializers.ModelSerializer):
    """Serializer for collaborator information in items"""
    name = serializers.SerializerMethodField()
    firstname = serializers.SerializerMethodField()
    lastname = serializers.SerializerMethodField()
    roles = serializers.SerializerMethodField()
    citation_author = serializers.SerializerMethodField()

    class Meta:
        model = Collaborator
        fields = ['slug', 'firstname', 'lastname', 'name', 'roles', 'citation_author']

    def get_name(self, obj):
        """Combine first and last name for display, or use 'Anonymous [slug]' if anonymous"""
        if obj.anonymous:
            return f"Anonymous {obj.slug}"
        if obj.firstname and obj.lastname:
            return f"{obj.firstname} {obj.lastname}"
        return obj.firstname or obj.lastname or obj.name

    def get_firstname(self, obj):
        """Return 'Anonymous' if anonymous, otherwise return firstname"""
        return 'Anonymous' if obj.anonymous else obj.firstname

    def get_lastname(self, obj):
        """Return slug if anonymous, otherwise return lastname"""
        return obj.slug if obj.anonymous else obj.lastname

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