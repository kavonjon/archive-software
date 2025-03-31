from rest_framework import viewsets
from oauth2_provider.contrib.rest_framework import TokenHasScope
from drf_spectacular.utils import extend_schema, OpenApiParameter, extend_schema_view
from metadata.models import Languoid
from ..serializers.languoids import LanguoidListSerializer, LanguoidDetailSerializer
from ...versioning import ArchiveAPIVersioning
from .items import IsAdminOrHasToken

@extend_schema_view(
    list=extend_schema(
        summary="List languoids",
        description="Returns a list of all languoids in the archive."
    ),
    retrieve=extend_schema(
        summary="Retrieve languoid",
        description="Returns detailed information about a specific languoid."
    )
)
class LanguoidViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for accessing Archive Languoids
    """
    permission_classes = [IsAdminOrHasToken]
    required_scopes = ['read']
    versioning_class = ArchiveAPIVersioning
    lookup_field = 'glottocode'

    def get_serializer_class(self):
        if self.action == 'list':
            return LanguoidListSerializer
        return LanguoidDetailSerializer

    def get_queryset(self):
        return Languoid.objects.all() 