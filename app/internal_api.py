"""
Internal API for React frontend
Provides CRUD operations for all core models with proper filtering and serialization
"""
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django_filters import FilterSet, CharFilter, DateFilter
from django.db.models import Q
from metadata.models import Item, Collection, Collaborator, Languoid
from api.v1.serializers.items import ItemSerializer
from api.v1.serializers.collections import CollectionSerializer
from api.v1.serializers.collaborators import CollaboratorSerializer
from api.v1.serializers.languoids import LanguoidSerializer


class ItemFilter(FilterSet):
    """Custom filter for Items with all the search fields from Django templates"""
    # Text search filters
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
            Q(collaborator__first_name__icontains=value) |
            Q(collaborator__last_name__icontains=value) |
            Q(collaborator__name__icontains=value)
        ).distinct()
    
    def filter_keyword(self, queryset, name, value):
        """Search across multiple text fields"""
        return queryset.filter(
            Q(catalog_number__icontains=value) |
            Q(call_number__icontains=value) |
            Q(description_scope_and_content__icontains=value) |
            Q(title_item__title__icontains=value) |
            Q(collaborator__first_name__icontains=value) |
            Q(collaborator__last_name__icontains=value) |
            Q(collaborator__name__icontains=value)
        ).distinct()


class InternalItemViewSet(viewsets.ModelViewSet):
    """Internal API for Items - used by React frontend"""
    queryset = Item.objects.all().prefetch_related(
        'title_item__language',
        'collaborator',
        'language',
        'collection'
    )
    serializer_class = ItemSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_class = ItemFilter
    search_fields = ['catalog_number', 'call_number', 'description_scope_and_content']
    ordering_fields = ['catalog_number', 'accession_date_min', 'creation_date_min']
    ordering = ['catalog_number']

    def get_queryset(self):
        """Ensure user has staff access"""
        if not self.request.user.is_staff:
            return Item.objects.none()
        return super().get_queryset()


class InternalCollectionViewSet(viewsets.ModelViewSet):
    """Internal API for Collections - used by React frontend"""
    queryset = Collection.objects.all().prefetch_related('languages')
    serializer_class = CollectionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'created']
    ordering = ['name']

    def get_queryset(self):
        """Ensure user has staff access"""
        if not self.request.user.is_staff:
            return Collection.objects.none()
        return super().get_queryset()


class InternalCollaboratorViewSet(viewsets.ModelViewSet):
    """Internal API for Collaborators - used by React frontend"""
    queryset = Collaborator.objects.all()
    serializer_class = CollaboratorSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    search_fields = ['first_name', 'last_name', 'name']
    ordering_fields = ['first_name', 'last_name', 'name']
    ordering = ['last_name', 'first_name']

    def get_queryset(self):
        """Ensure user has staff access"""
        if not self.request.user.is_staff:
            return Collaborator.objects.none()
        return super().get_queryset()


class InternalLanguoidViewSet(viewsets.ModelViewSet):
    """Internal API for Languoids - used by React frontend"""
    queryset = Languoid.objects.all()
    serializer_class = LanguoidSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    search_fields = ['name', 'iso_code']
    ordering_fields = ['name', 'iso_code']
    ordering = ['name']

    def get_queryset(self):
        """Ensure user has staff access"""
        if not self.request.user.is_staff:
            return Languoid.objects.none()
        return super().get_queryset()
