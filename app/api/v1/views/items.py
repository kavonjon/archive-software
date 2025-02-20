from rest_framework import viewsets, permissions
from oauth2_provider.contrib.rest_framework import TokenHasScope
from drf_spectacular.utils import extend_schema, OpenApiParameter, extend_schema_view
from drf_spectacular.types import OpenApiTypes
from metadata.models import Item
from ..serializers.items import ItemListSerializer, ItemDetailSerializer
from ...versioning import ArchiveAPIVersioning

class IsAdminOrHasToken(permissions.BasePermission):
    def has_permission(self, request, view):
        # Allow if user is admin
        if request.user and request.user.is_staff:
            return True
        # Otherwise check token permissions
        return TokenHasScope().has_permission(request, view)

@extend_schema_view(
    list=extend_schema(
        summary="List archive items",
        description="Returns a list of all items in the archive with their basic metadata.",
        parameters=[
            OpenApiParameter(
                name='catalog_number',
                type=str,
                description='Filter by catalog number',
                required=False
            ),
        ]
    ),
    retrieve=extend_schema(
        summary="Retrieve archive item",
        description="Returns detailed information about a specific archive item."
    )
)
class ItemViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for accessing Archive Items
    """
    permission_classes = [IsAdminOrHasToken]
    required_scopes = ['read']
    versioning_class = ArchiveAPIVersioning

    def get_serializer_class(self):
        if self.action == 'list':
            return ItemListSerializer
        return ItemDetailSerializer

    def get_queryset(self):
        queryset = Item.objects.all()
        catalog_number = self.request.query_params.get('catalog_number', None)
        if catalog_number is not None:
            queryset = queryset.filter(catalog_number=catalog_number)
        return queryset