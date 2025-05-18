from rest_framework import viewsets
from oauth2_provider.contrib.rest_framework import TokenHasScope
from drf_spectacular.utils import extend_schema, OpenApiParameter, extend_schema_view
from metadata.models import Collaborator
from ..serializers.collaborators import CollaboratorListSerializer, CollaboratorDetailSerializer
from ...versioning import ArchiveAPIVersioning
from django_filters import rest_framework as filters
from .items import IsAdminOrHasToken

class CollaboratorFilter(filters.FilterSet):
    name = filters.CharFilter(lookup_expr='icontains')
    firstname = filters.CharFilter(lookup_expr='icontains')
    lastname = filters.CharFilter(lookup_expr='icontains')
    
    class Meta:
        model = Collaborator
        fields = ['name', 'firstname', 'lastname']

@extend_schema_view(
    list=extend_schema(
        summary="List collaborators",
        description="Returns a list of all collaborators in the archive.",
        parameters=[
            OpenApiParameter(
                name='name',
                type=str,
                description='Filter by collaborator name (case-insensitive, partial match)',
                required=False
            ),
            OpenApiParameter(
                name='firstname',
                type=str,
                description='Filter by first name (case-insensitive, partial match)',
                required=False
            ),
            OpenApiParameter(
                name='lastname',
                type=str,
                description='Filter by last name (case-insensitive, partial match)',
                required=False
            ),
        ]
    ),
    retrieve=extend_schema(
        summary="Retrieve collaborator",
        description="Returns detailed information about a specific collaborator."
    )
)
class CollaboratorViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for accessing Archive Collaborators
    """
    permission_classes = [IsAdminOrHasToken]
    required_scopes = ['read']
    versioning_class = ArchiveAPIVersioning
    filterset_class = CollaboratorFilter
    lookup_field = 'slug'

    def get_queryset(self):
        return Collaborator.objects.all()

    def get_serializer_class(self):
        if self.action == 'list':
            return CollaboratorListSerializer
        return CollaboratorDetailSerializer 