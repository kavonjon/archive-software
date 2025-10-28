"""
Internal API for React frontend
Provides CRUD operations for all core models with proper filtering and serialization
"""
from rest_framework import viewsets, filters, status, permissions, serializers
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
    - Users must be in Archivist, Museum Staff, or Read-Only group (or be staff/superuser) to view (GET)
    - Staff users OR Archivist/Museum Staff groups can modify (POST, PUT, PATCH, DELETE)
    
    This allows Museum Staff (is_staff=False) to edit via React app while blocking Django admin access.
    Read-Only group members can view but not edit.
    """
    def has_permission(self, request, view):
        # Must be authenticated
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Check if user has view access (must be in a group or be staff/superuser)
        has_view_access = (
            request.user.is_staff or 
            request.user.is_superuser or
            request.user.groups.filter(name__in=['Archivist', 'Museum Staff', 'Read-Only']).exists()
        )
        
        if not has_view_access:
            return False
            
        # For read operations, view access is sufficient
        if request.method in permissions.SAFE_METHODS:
            return True
            
        # For write operations, need edit access (staff OR Archivist/Museum Staff groups)
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
            'level_nal': ['exact'],
            'level_glottolog': ['exact'],
            'region': ['icontains'],
            'tribes': ['icontains'],
        }
        # Remove alt_names from fields since it's a JSONField that needs special handling


class InternalLanguoidViewSet(viewsets.ModelViewSet):
    """Internal API for Languoids with hierarchical filtering and sorting
    
    Supports lookup by both ID and glottocode:
    - GET /internal/v1/languoids/123/ (numeric ID)
    - GET /internal/v1/languoids/cher1273/ (glottocode)
    """
    queryset = Languoid.objects.select_related(
        'family_languoid', 'parent_languoid', 'pri_subgroup_languoid', 
        'sec_subgroup_languoid'
    ).prefetch_related('child_languoids')
    serializer_class = InternalLanguoidSerializer
    permission_classes = [IsAuthenticatedWithEditAccess]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_class = LanguoidFilter
    search_fields = ['name', 'iso', 'glottocode', 'region', 'tribes']
    ordering_fields = ['name', 'iso', 'level_nal', 'added', 'updated']
    ordering = ['name']  # Default ordering by name
    lookup_field = 'pk'  # Can be either ID or glottocode
    
    def get_object(self):
        """
        Override to support lookup by both glottocode and ID
        Tries glottocode first (if it matches format), then falls back to ID
        """
        queryset = self.filter_queryset(self.get_queryset())
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        identifier = self.kwargs[lookup_url_kwarg]
        
        # Try glottocode first if it looks like a glottocode (8 chars, last 4 numeric)
        # or if it's clearly not a numeric ID
        if not identifier.isdigit():
            try:
                obj = queryset.get(glottocode=identifier)
                self.check_object_permissions(self.request, obj)
                return obj
            except Languoid.DoesNotExist:
                pass
        
        # Fall back to ID lookup
        try:
            obj = queryset.get(pk=identifier)
            self.check_object_permissions(self.request, obj)
            return obj
        except (Languoid.DoesNotExist, ValueError):
            pass
        
        # If neither worked, raise 404
        from rest_framework.exceptions import NotFound
        raise NotFound(f'Languoid with identifier "{identifier}" not found.')

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
        1. Families (level_nal='family') ordered by name
        2. Languages under their families (level_nal='language') 
        3. Dialects under their languages (level_nal='dialect')
        """
        from django.db.models import Case, When, Value, CharField
        
        # Create ordering that puts families first, then languages, then dialects
        # and orders by family hierarchy using FK relationships
        return queryset.annotate(
            hierarchy_order=Case(
                When(level_nal='family', then=Value('1')),
                When(level_nal='language', then=Value('2')),
                When(level_nal='dialect', then=Value('3')),
                default=Value('4'),
                output_field=CharField()
            )
        ).order_by(
            'hierarchy_order',
            'family_languoid__name',  # Group by family name via FK
            'pri_subgroup_languoid__name',  # Then by primary subgroup via FK
            'sec_subgroup_languoid__name',  # Then by secondary subgroup via FK
            'name'  # Finally by name
        )

    def get_serializer_context(self):
        """Add request context for user tracking in serializer"""
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    @action(detail=False, methods=['post'], url_path='validate-field')
    def validate_field(self, request):
        """
        Validate a single field value for batch editing
        
        POST /internal/v1/languoids/validate-field/
        Body: {
            "field_name": "glottocode",
            "value": "stan1295",
            "row_id": "draft-123" or 42 (languoid id),
            "original_value": "stan1295" (optional - value when loaded from DB)
        }
        
        Returns: {
            "valid": true/false,
            "error": "error message if invalid"
        }
        """
        field_name = request.data.get('field_name')
        value = request.data.get('value')
        row_id = request.data.get('row_id')
        original_value = request.data.get('original_value')  # New parameter
        
        if not field_name:
            return Response(
                {'valid': False, 'error': 'field_name is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get the serializer to use its validation methods
        serializer = self.get_serializer()
        
        # Try to validate the field using serializer's field validators
        try:
            # Get the field from the serializer
            if field_name not in serializer.fields:
                return Response(
                    {'valid': False, 'error': f'Unknown field: {field_name}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            field = serializer.fields[field_name]
            
            # Run field-level validation
            field.run_validation(value)
            
            # Check for field-specific validator methods (e.g., validate_glottocode)
            validate_method_name = f'validate_{field_name}'
            if hasattr(serializer, validate_method_name):
                validate_method = getattr(serializer, validate_method_name)
                validate_method(value)
            
            # Field-specific uniqueness checks
            if field_name == 'glottocode' and value:
                # If value equals original_value, it's valid (editing back to self)
                if original_value is not None and value == original_value:
                    return Response({'valid': True})
                
                # Check for uniqueness (exclude current row if editing)
                existing = Languoid.objects.filter(glottocode=value)
                
                # Exclude the current row being edited
                if str(row_id).startswith('draft-'):
                    # Draft row - don't exclude anything (it's a new row)
                    pass
                else:
                    # Existing row - exclude it from uniqueness check
                    try:
                        row_id_int = int(row_id) if isinstance(row_id, str) else row_id
                        existing = existing.exclude(id=row_id_int)
                    except (ValueError, TypeError):
                        # If we can't convert to int, skip exclusion
                        pass
                
                if existing.exists():
                    return Response({
                        'valid': False,
                        'error': f'Glottocode "{value}" already exists.'
                    })
            
            return Response({'valid': True})
            
        except serializers.ValidationError as e:
            # Extract error message
            if isinstance(e.detail, dict):
                error_msg = str(list(e.detail.values())[0][0]) if e.detail else 'Validation error'
            elif isinstance(e.detail, list):
                error_msg = str(e.detail[0])
            else:
                error_msg = str(e.detail)
            
            return Response({
                'valid': False,
                'error': error_msg
            })
        except Exception as e:
            return Response({
                'valid': False,
                'error': str(e)
            })
    
    @action(detail=False, methods=['post'], url_path='save-batch')
    def save_batch(self, request):
        """
        Save multiple languoids in a single transaction
        
        POST /internal/v1/languoids/save-batch/
        Body: {
            "rows": [
                {
                    "id": 42 or "draft-uuid",
                    "name": "English",
                    "glottocode": "stan1293",
                    "level": "language",
                    ...
                },
                ...
            ]
        }
        
        Returns: {
            "success": true,
            "saved": [{"id": 42, ...}, ...],
            "errors": []
        }
        """
        from django.db import transaction
        import logging
        logger = logging.getLogger(__name__)
        
        rows = request.data.get('rows', [])
        logger.info(f"save_batch received {len(rows)} rows")
        logger.info(f"Request data: {request.data}")
        
        if not rows:
            return Response(
                {'success': False, 'errors': ['No rows provided']},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        saved_objects = []
        errors = []
        
        try:
            with transaction.atomic():
                for row in rows:
                    row_id = row.get('id')
                    is_draft = isinstance(row_id, str) and str(row_id).startswith('draft-')
                    
                    try:
                        if is_draft:
                            # Create new languoid
                            logger.info(f"Creating new languoid from draft: {row_id}")
                            # Remove the draft ID before serialization
                            row_data = {k: v for k, v in row.items() if k != 'id'}
                            logger.info(f"Row data for creation: {row_data}")
                            serializer = self.get_serializer(data=row_data)
                            serializer.is_valid(raise_exception=True)
                            instance = serializer.save()
                            saved_objects.append(instance)
                        else:
                            # Update existing languoid
                            logger.info(f"Updating existing languoid: {row_id}")
                            try:
                                instance = Languoid.objects.get(pk=row_id)
                            except Languoid.DoesNotExist:
                                errors.append(f"Languoid with ID {row_id} not found")
                                continue
                            
                            serializer = self.get_serializer(instance, data=row, partial=True)
                            serializer.is_valid(raise_exception=True)
                            instance = serializer.save()
                            saved_objects.append(instance)
                    
                    except serializers.ValidationError as e:
                        # Collect validation errors
                        logger.error(f"Validation error for row {row_id}: {e.detail}")
                        error_msg = f"Row ID {row_id}: "
                        if isinstance(e.detail, dict):
                            error_msg += ", ".join([f"{k}: {v[0]}" if isinstance(v, list) else f"{k}: {v}" 
                                                   for k, v in e.detail.items()])
                        else:
                            error_msg += str(e.detail)
                        errors.append(error_msg)
                
                # If any errors occurred, rollback transaction
                if errors:
                    raise Exception("Validation errors occurred")
                
                # Serialize saved objects for response
                response_serializer = self.get_serializer(saved_objects, many=True)
                return Response({
                    'success': True,
                    'saved': response_serializer.data,
                    'errors': []
                })
        
        except Exception as e:
            return Response({
                'success': False,
                'saved': [],
                'errors': errors if errors else [str(e)]
            }, status=status.HTTP_400_BAD_REQUEST)


    
    @action(detail=True, methods=['get'], url_path='descendants-tree')
    def descendants_tree(self, request, pk=None):
        """
        Get hierarchical tree of all descendants for a languoid
        
        GET /internal/v1/languoids/{id}/descendants-tree/
        
        Returns: [
            {
                "id": 1,
                "name": "Malayo-Polynesian",
                "glottocode": "mala1545",
                "level_nal": "subfamily",
                "level_display": "Primary Subfamily",
                "children": [...]
            }
        ]
        """
        languoid = self.get_object()
        
        def build_tree(parent_id):
            """Recursively build tree structure from parent-child relationships"""
            children = Languoid.objects.filter(
                parent_languoid_id=parent_id
            ).select_related(
                'parent_languoid'
            ).order_by('name')
            
            tree = []
            for child in children:
                node = {
                    'id': child.id,
                    'name': child.name,
                    'glottocode': child.glottocode,
                    'level_nal': child.level_nal,
                    'level_display': child.get_level_nal_display(),
                    'children': build_tree(child.id)  # Recursive call
                }
                tree.append(node)
            
            return tree
        
        descendants = build_tree(languoid.id)
        
        return Response(descendants)
    
    @action(detail=False, methods=['get'], url_path='last-modified')
    def last_modified(self, request):
        """
        Get the timestamp of the most recently modified languoid.
        Used for cache invalidation on the frontend.
        
        GET /internal/v1/languoids/last-modified/
        
        Returns: {
            "last_modified": "2025-10-28T12:34:56.789Z",
            "count": 1234
        }
        """
        from django.db.models import Max, Count
        
        # Get the most recent update timestamp
        result = Languoid.objects.aggregate(
            last_modified=Max('updated'),
            count=Count('id')
        )
        
        last_modified = result.get('last_modified')
        count = result.get('count', 0)
        
        # If no languoids exist, return current time
        if last_modified is None:
            from django.utils import timezone
            last_modified = timezone.now()
        
        return Response({
            'last_modified': last_modified.isoformat(),
            'count': count
        })

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
