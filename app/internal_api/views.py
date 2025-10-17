"""
Internal API for React frontend
Provides CRUD operations for all core models with proper filtering and serialization
"""
from rest_framework import viewsets, filters, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django_filters import FilterSet, CharFilter, DateFilter
from django.db.models import Q
from metadata.models import Item, Collection, Collaborator, Languoid, ItemTitle
from .serializers import (
    InternalItemSerializer, 
    InternalCollectionSerializer, 
    InternalCollaboratorSerializer, 
    InternalLanguoidSerializer,
    InternalItemTitleSerializer
)


class IsAuthenticatedWithEditAccess(permissions.BasePermission):
    """
    Custom permission for internal API:
    - All authenticated users can read (GET requests)
    - Staff users OR Archivist/Museum Staff groups can modify (POST, PUT, PATCH, DELETE)
    
    This allows Museum Staff (is_staff=False) to edit via React app while blocking Django admin access.
    """
    def has_permission(self, request, view):
        # Must be authenticated
        if not request.user or not request.user.is_authenticated:
            return False
            
        # Allow all authenticated users for read operations
        if request.method in permissions.SAFE_METHODS:
            return True
            
        # Allow staff OR specific groups to modify data
        return (request.user.is_staff or 
                request.user.groups.filter(name__in=['Archivist', 'Museum Staff']).exists())


class ItemFilter(FilterSet):
    """Custom filter for Items with all the search fields from Django templates"""
    # Text search filters
    catalog_number = CharFilter(field_name='catalog_number', lookup_expr='exact')  # Exact match for uniqueness validation
    catalog_number_contains = CharFilter(field_name='catalog_number', lookup_expr='icontains')
    item_access_level_contains = CharFilter(field_name='item_access_level', lookup_expr='icontains')
    call_number_contains = CharFilter(field_name='call_number', lookup_expr='icontains')
    indigenous_title_contains = CharFilter(method='filter_indigenous_title')
    english_title_contains = CharFilter(method='filter_english_title')
    titles_contains = CharFilter(method='filter_all_titles')
    resource_type_contains = CharFilter(field_name='resource_type', lookup_expr='icontains')
    language_contains = CharFilter(method='filter_language')
    description_scope_and_content_contains = CharFilter(field_name='description_scope_and_content', lookup_expr='icontains')
    genre_contains = CharFilter(field_name='genre', lookup_expr='icontains')
    collaborator_contains = CharFilter(method='filter_collaborator')
    depositor_name_contains = CharFilter(field_name='depositor_name', lookup_expr='icontains')
    keyword_contains = CharFilter(method='filter_keyword')
    
    # Date range filters
    accession_date_min = DateFilter(field_name='accession_date_min', lookup_expr='gte')
    accession_date_max = DateFilter(field_name='accession_date_max', lookup_expr='lte')
    creation_date_min = DateFilter(field_name='creation_date_min', lookup_expr='gte')
    creation_date_max = DateFilter(field_name='creation_date_max', lookup_expr='lte')

    class Meta:
        model = Item
        fields = [
            'catalog_number',  # Exact match for uniqueness validation
            'catalog_number_contains',
            'item_access_level_contains', 
            'call_number_contains',
            'accession_date_min',
            'accession_date_max',
            'indigenous_title_contains',
            'english_title_contains',
            'titles_contains',
            'resource_type_contains',
            'language_contains',
            'creation_date_min',
            'creation_date_max',
            'description_scope_and_content_contains',
            'genre_contains',
            'collaborator_contains',
            'depositor_name_contains',
            'keyword_contains',
        ]

    def filter_indigenous_title(self, queryset, name, value):
        """Filter by indigenous titles"""
        return queryset.filter(title_item__title__icontains=value, title_item__language__name__icontains='indigenous').distinct()
    
    def filter_english_title(self, queryset, name, value):
        """Filter by English titles"""
        return queryset.filter(title_item__title__icontains=value, title_item__language__name__icontains='english').distinct()
    
    def filter_all_titles(self, queryset, name, value):
        """Filter by any title"""
        return queryset.filter(title_item__title__icontains=value).distinct()
    
    def filter_language(self, queryset, name, value):
        """Filter by language name"""
        return queryset.filter(language__name__icontains=value).distinct()
    
    def filter_collaborator(self, queryset, name, value):
        """Filter by collaborator name"""
        return queryset.filter(
            Q(collaborator__firstname__icontains=value) |
            Q(collaborator__lastname__icontains=value) |
            Q(collaborator__name__icontains=value)
        ).distinct()
    
    def filter_keyword(self, queryset, name, value):
        """Search across multiple text fields"""
        return queryset.filter(
            Q(catalog_number__icontains=value) |
            Q(call_number__icontains=value) |
            Q(description_scope_and_content__icontains=value) |
            Q(title_item__title__icontains=value) |
            Q(collaborator__firstname__icontains=value) |
            Q(collaborator__lastname__icontains=value) |
            Q(collaborator__name__icontains=value)
        ).distinct()


class CollectionFilter(FilterSet):
    """Custom filter for Collections with exact match support for uniqueness validation"""
    # Text search filters
    collection_abbr = CharFilter(field_name='collection_abbr', lookup_expr='exact')  # Exact match for uniqueness validation
    collection_abbr_contains = CharFilter(field_name='collection_abbr', lookup_expr='icontains')
    name_contains = CharFilter(field_name='name', lookup_expr='icontains')
    description_contains = CharFilter(field_name='description', lookup_expr='icontains')
    
    class Meta:
        model = Collection
        fields = [
            'collection_abbr',  # Exact match for uniqueness validation
            'collection_abbr_contains',
            'name_contains',
            'description_contains',
        ]


class InternalItemViewSet(viewsets.ModelViewSet):
    """Internal API for Items - used by React frontend"""
    queryset = Item.objects.all().prefetch_related(
        'title_item__language',
        'collaborator',
        'language',
        'collection'
    )
    serializer_class = InternalItemSerializer
    permission_classes = [IsAuthenticatedWithEditAccess]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_class = ItemFilter
    search_fields = ['catalog_number', 'call_number', 'description_scope_and_content']
    ordering_fields = ['catalog_number', 'accession_date_min', 'creation_date_min']
    ordering = ['catalog_number']

    def get_queryset(self):
        """All authenticated users can see all items, permissions handled by permission_classes"""
        if not self.request.user.is_authenticated:
            return Item.objects.none()
        return super().get_queryset()


class InternalCollectionViewSet(viewsets.ModelViewSet):
    """Internal API for Collections - used by React frontend"""
    queryset = Collection.objects.all().prefetch_related('languages')
    serializer_class = InternalCollectionSerializer
    permission_classes = [IsAuthenticatedWithEditAccess]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_class = CollectionFilter
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created']
    ordering = ['name']

    def get_queryset(self):
        """All authenticated users can see all collections, permissions handled by permission_classes"""
        if not self.request.user.is_authenticated:
            return Collection.objects.none()
        return super().get_queryset()


class InternalCollaboratorViewSet(viewsets.ModelViewSet):
    """Internal API for Collaborators - used by React frontend"""
    queryset = Collaborator.objects.all().prefetch_related('native_languages', 'other_languages', 'collaborator_collaboratorroles__item__collection')
    serializer_class = InternalCollaboratorSerializer
    permission_classes = [IsAuthenticatedWithEditAccess]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_fields = ['anonymous', 'gender', 'collaborator_id']
    search_fields = ['firstname', 'lastname', 'name', 'collaborator_id', 'tribal_affiliations']
    ordering_fields = ['firstname', 'lastname', 'name', 'collaborator_id', 'added', 'updated']
    ordering = ['lastname', 'firstname', 'name', 'collaborator_id']

    def get_queryset(self):
        """All authenticated users can see all collaborators, permissions handled by permission_classes"""
        if not self.request.user.is_authenticated:
            return Collaborator.objects.none()
        return super().get_queryset()
    
    def get_serializer_context(self):
        """Add request to serializer context for privacy logic"""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


class LanguoidFilter(FilterSet):
    """Custom filter for Languoids with hierarchical level filtering and exact match support"""
    
    # Exact match filters for uniqueness validation
    name = CharFilter(field_name='name', lookup_expr='exact')
    glottocode = CharFilter(field_name='glottocode', lookup_expr='exact')
    iso = CharFilter(field_name='iso', lookup_expr='exact')
    
    class Meta:
        model = Languoid
        fields = {
            'name': ['icontains', 'exact'],
            'iso': ['icontains', 'exact'],
            'glottocode': ['icontains', 'exact'],
            'level': ['exact'],
            'family': ['icontains'],
            'family_id': ['exact'],
            'region': ['icontains'],
            'alt_name': ['icontains'],
            'tribes': ['icontains'],
        }
        # Remove alt_names from fields since it's a JSONField that needs special handling


class InternalLanguoidViewSet(viewsets.ModelViewSet):
    """Internal API for Languoids with hierarchical filtering and sorting"""
    queryset = Languoid.objects.select_related(
        'family_languoid', 'parent_languoid', 'pri_subgroup_languoid', 
        'sec_subgroup_languoid', 'language_languoid'
    ).prefetch_related('child_languoids', 'child_dialects_languoids')
    serializer_class = InternalLanguoidSerializer
    permission_classes = [IsAuthenticatedWithEditAccess]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_class = LanguoidFilter
    search_fields = ['name', 'iso', 'glottocode', 'family', 'alt_name', 'region', 'tribes']
    ordering_fields = ['name', 'iso', 'family', 'level', 'added', 'updated']
    ordering = ['family', 'name']  # Default hierarchical ordering

    def get_queryset(self):
        """Enhanced queryset with hierarchical ordering support"""
        if not self.request.user.is_authenticated:
            return Languoid.objects.none()
        
        queryset = super().get_queryset()
        
        # Check for hierarchical ordering parameter
        hierarchical = self.request.query_params.get('hierarchical', 'false').lower() == 'true'
        
        if hierarchical:
            # Custom hierarchical ordering: families first, then their children
            queryset = self._get_hierarchical_queryset(queryset)
        
        return queryset
    
    def _get_hierarchical_queryset(self, queryset):
        """
        Return queryset ordered hierarchically:
        1. Families (level='family') ordered by name
        2. Languages under their families (level='language') 
        3. Dialects under their languages (level='dialect')
        """
        from django.db.models import Case, When, Value, CharField
        
        # Create ordering that puts families first, then languages, then dialects
        # and orders by family hierarchy
        return queryset.annotate(
            hierarchy_order=Case(
                When(level='family', then=Value('1')),
                When(level='language', then=Value('2')),
                When(level='dialect', then=Value('3')),
                default=Value('4'),
                output_field=CharField()
            )
        ).order_by(
            'hierarchy_order',
            'family',  # Group by family name
            'pri_subgroup',  # Then by primary subgroup
            'sec_subgroup',  # Then by secondary subgroup
            'name'  # Finally by name
        )

    def get_serializer_context(self):
        """Add request context for user tracking in serializer"""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context


class InternalItemTitleViewSet(viewsets.ModelViewSet):
    """Nested API for ItemTitles under Items - used by React frontend"""
    serializer_class = InternalItemTitleSerializer
    permission_classes = [IsAuthenticatedWithEditAccess]
    
    def get_queryset(self):
        """Filter titles by the parent item"""
        if not self.request.user.is_authenticated:
            return ItemTitle.objects.none()
            
        item_pk = self.kwargs.get('item_pk')
        if item_pk:
            return ItemTitle.objects.filter(item_id=item_pk).select_related('language', 'item')
        return ItemTitle.objects.none()
    
    def get_serializer_context(self):
        """Add item to serializer context for validation"""
        context = super().get_serializer_context()
        item_pk = self.kwargs.get('item_pk')
        if item_pk:
            try:
                context['item'] = Item.objects.get(pk=item_pk)
            except Item.DoesNotExist:
                pass
        return context
    
    def perform_create(self, serializer):
        """Handle default title business rule on create"""
        # If this is being set as default, unset other defaults for this item
        if serializer.validated_data.get('default', False):
            item_pk = self.kwargs.get('item_pk')
            ItemTitle.objects.filter(item_id=item_pk, default=True).update(default=False)
        
        serializer.save()
    
    def perform_update(self, serializer):
        """Handle default title business rule on update"""
        # If this is being set as default, unset other defaults for this item
        if serializer.validated_data.get('default', False):
            item_pk = self.kwargs.get('item_pk')
            ItemTitle.objects.filter(
                item_id=item_pk, 
                default=True
            ).exclude(
                id=serializer.instance.id
            ).update(default=False)
        
        serializer.save()
    
    def perform_destroy(self, instance):
        """Handle title deletion with business rule validation"""
        item_pk = self.kwargs.get('item_pk')
        
        # Check if this is the last title - prevent deletion
        title_count = ItemTitle.objects.filter(item_id=item_pk).count()
        if title_count <= 1:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Cannot delete the only title. Add another title first.")
        
        # If deleting the default title, set another one as default
        if instance.default:
            # Find another title to make default
            new_default = ItemTitle.objects.filter(
                item_id=item_pk
            ).exclude(id=instance.id).first()
            
            if new_default:
                new_default.default = True
                new_default.save()
        
        instance.delete()
    
    @action(detail=True, methods=['post'])
    def set_default(self, request, item_pk=None, pk=None):
        """Set a specific title as the default for the item"""
        try:
            title = self.get_object()
            
            # Unset other defaults for this item
            ItemTitle.objects.filter(
                item_id=item_pk, 
                default=True
            ).exclude(id=title.id).update(default=False)
            
            # Set this title as default
            title.default = True
            title.save()
            
            serializer = self.get_serializer(title)
            return Response(serializer.data)
            
        except ItemTitle.DoesNotExist:
            return Response(
                {'error': 'Title not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
