from rest_framework import viewsets
from oauth2_provider.contrib.rest_framework import TokenHasScope
from drf_spectacular.utils import extend_schema, OpenApiParameter, extend_schema_view
from metadata.models import Collection
from ..serializers.collections import CollectionListSerializer, CollectionDetailSerializer
from ...versioning import ArchiveAPIVersioning
from django_filters import rest_framework as filters
from .items import IsAdminOrHasToken

class CollectionFilter(filters.FilterSet):
    name = filters.CharFilter(lookup_expr='icontains')
    collection_abbr = filters.CharFilter(lookup_expr='iexact')
    
    class Meta:
        model = Collection
        fields = ['name', 'collection_abbr']

@extend_schema_view(
    list=extend_schema(
        summary="List collections",
        description="Returns a list of all collections in the archive.",
        parameters=[
            OpenApiParameter(
                name='name',
                type=str,
                description='Filter by collection name (case-insensitive, partial match)',
                required=False
            ),
            OpenApiParameter(
                name='collection_abbr',
                type=str,
                description='Filter by collection abbreviation (exact match)',
                required=False
            ),
        ]
    ),
    retrieve=extend_schema(
        summary="Retrieve collection",
        description="Returns detailed information about a specific collection."
    )
)
class CollectionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for accessing Archive Collections
    """
    permission_classes = [IsAdminOrHasToken]
    required_scopes = ['read']
    versioning_class = ArchiveAPIVersioning
    filterset_class = CollectionFilter

    def get_queryset(self):
        return Collection.objects.all()

    def get_serializer_class(self):
        if self.action == 'list':
            return CollectionListSerializer
        return CollectionDetailSerializer 