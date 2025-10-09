from rest_framework import viewsets, permissions, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from metadata.models import Item, Collection, Collaborator, Languoid
from .serializers import ItemSerializer, CollectionSerializer, CollaboratorSerializer, LanguoidSerializer


class IsAuthenticatedStaff(permissions.BasePermission):
    """
    Custom permission to only allow authenticated staff users.
    This ensures internal APIs are only accessible to logged-in staff members.
    """
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.is_staff


class ItemViewSet(viewsets.ModelViewSet):
    """
    Internal API ViewSet for Items with full CRUD operations.
    Provides comprehensive access to Item data for the React frontend.
    """
    queryset = Item.objects.all().select_related('collection').prefetch_related('titles', 'collaborators', 'content_languages')
    serializer_class = ItemSerializer
    permission_classes = [IsAuthenticatedStaff]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['collection', 'access_level', 'resource_type', 'genre']
    search_fields = ['catalog_number', 'titles__title', 'notes']
    ordering_fields = ['catalog_number', 'added', 'updated']
    ordering = ['-updated']

    @action(detail=True, methods=['patch'])
    def update_field(self, request, pk=None):
        """
        Update a single field of an item for inline editing.
        Expects: {"field": "field_name", "value": "new_value"}
        """
        item = self.get_object()
        field = request.data.get('field')
        value = request.data.get('value')
        
        if field and hasattr(item, field):
            setattr(item, field, value)
            item.save()
            serializer = self.get_serializer(item)
            return Response(serializer.data)
        
        return Response({'error': 'Invalid field or value'}, status=400)


class CollectionViewSet(viewsets.ModelViewSet):
    """
    Internal API ViewSet for Collections with full CRUD operations.
    """
    queryset = Collection.objects.all()
    serializer_class = CollectionSerializer
    permission_classes = [IsAuthenticatedStaff]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['collection_abbr', 'name', 'abstract']
    ordering_fields = ['collection_abbr', 'name', 'added', 'updated']
    ordering = ['collection_abbr']


class CollaboratorViewSet(viewsets.ModelViewSet):
    """
    Internal API ViewSet for Collaborators with full CRUD operations.
    """
    queryset = Collaborator.objects.all().prefetch_related('native_languages', 'other_languages', 'roles')
    serializer_class = CollaboratorSerializer
    permission_classes = [IsAuthenticatedStaff]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['anonymous', 'gender']
    search_fields = ['last_name', 'first_name', 'middle_name', 'tribal_affiliations']
    ordering_fields = ['last_name', 'first_name', 'added', 'updated']
    ordering = ['last_name', 'first_name']


class LanguoidViewSet(viewsets.ModelViewSet):
    """
    Internal API ViewSet for Languoids (Languages/Dialects) with full CRUD operations.
    """
    queryset = Languoid.objects.all()
    serializer_class = LanguoidSerializer
    permission_classes = [IsAuthenticatedStaff]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'iso', 'family', 'alt_name', 'alt_names']
    ordering_fields = ['name', 'iso', 'family', 'added', 'updated']
    ordering = ['name']
