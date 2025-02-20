from rest_framework import viewsets
from oauth2_provider.contrib.rest_framework import TokenHasScope
from drf_spectacular.utils import extend_schema, OpenApiParameter, extend_schema_view
from metadata.models import Language
from ..serializers.languages import LanguageListSerializer, LanguageDetailSerializer
from ...versioning import ArchiveAPIVersioning
from .items import IsAdminOrHasToken

@extend_schema_view(
    list=extend_schema(
        summary="List languages",
        description="Returns a list of all languages in the archive."
    ),
    retrieve=extend_schema(
        summary="Retrieve language",
        description="Returns detailed information about a specific language."
    )
)
class LanguageViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for accessing Archive Languages
    """
    permission_classes = [IsAdminOrHasToken]
    required_scopes = ['read']
    versioning_class = ArchiveAPIVersioning

    def get_serializer_class(self):
        if self.action == 'list':
            return LanguageListSerializer
        return LanguageDetailSerializer

    def get_queryset(self):
        return Language.objects.all() 