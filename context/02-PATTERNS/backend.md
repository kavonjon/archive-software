# Backend Patterns (Django + DRF + Celery)

## Django REST Framework

### ViewSet Pattern

**Standard structure**:
```python
class InternalItemViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedWithEditAccess]
    queryset = Item.objects.all()
    serializer_class = InternalItemSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_class = ItemFilter
    
    def get_serializer_class(self):
        if self.request.query_params.get('batch') == 'true':
            return InternalItemBatchSerializer
        if self.request.query_params.get('picker') == 'true':
            return InternalItemPickerSerializer
        return InternalItemSerializer
    
    @action(detail=False, methods=['post'])
    def save_batch(self, request):
        # Custom batch save logic
        pass
```

**Key Elements**:
- Permission classes for all actions
- Conditional serializers via query params
- Custom actions for batch operations

### Two Serializers Per Model

**Full Serializer** (Detail/Create/Update):
```python
class InternalItemSerializer(serializers.ModelSerializer):
    # All fields
    resource_type_display = serializers.CharField(
        source='get_resource_type_display', 
        read_only=True
    )
    
    # Virtual fields
    primary_title = serializers.SerializerMethodField()
    
    def get_primary_title(self, obj):
        title = obj.title_item.filter(default=True).first()
        if title:
            return {
                'title': title.title,
                'language': {'id': title.language.id, ...} if title.language else None
            }
        return None
    
    class Meta:
        model = Item
        fields = '__all__'  # Or explicit list
```

**Batch Serializer** (List/Cache):
```python
class InternalItemBatchSerializer(serializers.ModelSerializer):
    # Minimal but includes ALL filter fields
    primary_title = serializers.SerializerMethodField()
    secondary_title = serializers.SerializerMethodField()
    titles = serializers.SerializerMethodField()  # For filtering
    collaborators = serializers.SerializerMethodField()  # For filtering
    
    def get_titles(self, obj):
        return [{
            'id': t.id,
            'title': t.title,
            'language': {...} if t.language else None,
            'default': t.default
        } for t in obj.title_item.all()]
    
    class Meta:
        model = Item
        exclude = ['internal_notes', 'verbose_fields']  # Exclude heavy fields
```

**Critical Rule**: Batch serializer must include ALL fields needed for client-side filtering.

### Choice Field Display Values

**Pattern**: Provide both value and display label

```python
class ItemSerializer(serializers.ModelSerializer):
    resource_type = serializers.CharField()
    resource_type_display = serializers.CharField(
        source='get_resource_type_display',
        read_only=True
    )
```

**For MultiSelectField** (custom implementation needed):
```python
genre_display = serializers.SerializerMethodField()

def get_genre_display(self, obj):
    from metadata.models import GENRE_CHOICES
    genre_dict = dict(GENRE_CHOICES)
    return [genre_dict.get(value, value) for value in obj.genre]
```

---

### Audit Tracking with `modified_by`

**Pattern**: Track which user created/modified a record

```python
class InternalCollaboratorViewSet(viewsets.ModelViewSet):
    def perform_create(self, serializer):
        serializer.save(modified_by=self.request.user)
    
    def perform_update(self, serializer):
        serializer.save(modified_by=self.request.user)
```

**Apply to**: Any ViewSet where model has a `modified_by` FK field.

---

## Service Layer

### Pattern

**Purpose**: Centralize business logic, separate from views

**Structure**:
```python
# app/metadata/services.py

class CollaboratorService:
    @staticmethod
    def get_filtered_collaborators(filters: dict, user):
        """Apply business logic filters"""
        queryset = Collaborator.objects.all()
        
        if not user.is_staff:
            queryset = queryset.exclude(anonymous=True)
        
        if filters.get('keyword'):
            queryset = queryset.filter(
                Q(full_name__icontains=filters['keyword'])
            )
        
        return queryset
    
    @staticmethod
    def generate_export(queryset):
        """Generate export file"""
        # Export logic here
        pass
```

**Usage in ViewSet**:
```python
def list(self, request):
    filters = self.get_filter_params(request)
    queryset = CollaboratorService.get_filtered_collaborators(filters, request.user)
    # ... serialize and return
```

**Benefits**:
- Reusable across views, tasks, management commands
- Testable in isolation
- Thin views (orchestration only)

---

## Signals

### Pre-Save Signals (Computed Fields)

**Pattern**: Use for derived fields that must always be computed

```python
from django.db.models.signals import pre_save
from django.dispatch import receiver

@receiver(pre_save, sender=Collaborator)
def compute_collaborator_derived_fields(sender, instance, **kwargs):
    # Compute full_name from components
    parts = [
        instance.first_names,
        f'"{instance.nickname}"' if instance.nickname else None,
        instance.last_names,
        instance.name_suffix
    ]
    instance.full_name = ' '.join(filter(None, parts)).strip()
    
    # Compute slug
    if not instance.slug:
        instance.slug = generate_slug(instance.full_name)
    
    # Standardize dates
    if instance.birth_date:
        instance.birth_date = standardize_date_format(instance.birth_date)
```

**Use For**:
- full_name, slug (Collaborator)
- level_nal, hierarchy FKs (Languoid)
- browse_categories, collection (Item)
- Date standardization (MM/DD/YYYY to YYYY/MM/DD)

### M2M Changed Signals (Relationship Rules)

**Pattern**: Enforce integrity constraints on M2M relationships

```python
from django.db.models.signals import m2m_changed

@receiver(m2m_changed, sender=Collaborator.native_languages.through)
def auto_add_parent_language_for_collaborator_dialects(sender, instance, action, pk_set, **kwargs):
    if action not in ['post_add', 'post_clear', 'post_remove']:
        return
    
    # Check ALL current languoids (not just added ones)
    all_languoids = instance.native_languages.all()
    
    parents_to_add = []
    for languoid in all_languoids:
        if languoid.level_glottolog == 'dialect' and languoid.parent_languoid:
            if not all_languoids.filter(id=languoid.parent_languoid.id).exists():
                parents_to_add.append(languoid.parent_languoid)
    
    if parents_to_add:
        instance.native_languages.add(*parents_to_add)
```

**Use For**:
- Auto-add parent languages when dialects selected
- Maintain computed caches (descendents M2M)
- Enforce relationship rules

### Post-Save Signals (Async Tasks)

**Pattern**: Trigger expensive operations asynchronously

```python
from django.db.models.signals import post_save

@receiver(post_save, sender=Languoid)
def schedule_languoid_hierarchy_update(sender, instance, created, **kwargs):
    # Check if expensive update needed
    if hasattr(instance, '_needs_dialect_orphaning'):
        # Debounce with cache key
        cache_key = f'languoid_hierarchy_update_scheduled_{instance.id}'
        if cache.get(cache_key):
            return  # Already scheduled
        cache.set(cache_key, '1', 10)
        
        # Schedule Celery task
        update_languoid_hierarchy_task.apply_async(
            args=[instance.id, getattr(instance, '_old_parent_id', None)],
            priority=9
        )
```

**Use For**:
- Hierarchy updates (Languoid)
- Cache invalidation/rebuild
- Cascading updates

---

## Celery Tasks

### Task Decorator Pattern

**Standard**:
```python
from celery import shared_task

@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def my_task(self, arg1, arg2):
    try:
        # Task logic
        logger.info(f"Task started with {arg1}")
        
        result = do_work(arg1, arg2)
        
        logger.info(f"Task completed")
        return {'status': 'success', 'result': result}
        
    except Exception as e:
        logger.error(f"Task failed: {e}")
        return {'status': 'error', 'error': str(e)}
```

**Key Points**:
- `bind=True` gives access to `self`
- Return error dict (not `raise self.retry()` - causes silent failures)
- Log generously (task failures can be silent)
- max_retries=3, default_retry_delay=30 (standard)

### Task Priority

**Priority scale**: 0 (low) to 10 (high)

**Guidelines**:
- **10**: User-facing (exports, immediate operations)
- **9**: Data integrity (hierarchy updates, critical computations)
- **8**: Cache management (invalidation, warming)
- **5**: Cascading updates (delayed, non-urgent)
- **0-4**: Background maintenance

**Example**:
```python
warm_item_list_cache.apply_async(priority=8)
update_languoid_hierarchy_task.apply_async(priority=9)
```

### Debouncing Tasks

**Pattern**: Prevent duplicate task scheduling

```python
cache_key = f'task_scheduled_{model_id}'
if cache.get(cache_key):
    return  # Already scheduled
cache.set(cache_key, '1', timeout=10)  # 10 second debounce

my_task.apply_async(args=[model_id], priority=8)
```

---

## Django Patterns

### FilterSet Classes (django-filter)

**Pattern**: Database-level filtering via `django_filters.FilterSet`, not serializer filtering

```python
class ItemFilter(FilterSet):
    keyword_contains = CharFilter(method='filter_keyword')
    language_description_type = CharFilter(method='filter_language_description_type')
    collection_contains = CharFilter(method='filter_collection')
    original_format_medium = CharFilter(method='filter_original_format_medium')
    # ... *_contains text filters, *_isnull empty toggles, choice multi-selects

    class Meta:
        model = Item
        fields = [...]

    def filter_keyword(self, queryset, name, value):
        return queryset.filter(
            Q(catalog_number__icontains=value) |
            Q(description_scope_and_content__icontains=value) |
            # ... all cross-field OR targets
        ).distinct()
```

**ViewSet wiring:**
```python
filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
filterset_class = ItemFilter
```

**Benefits**:
- Efficient (database-level)
- Composable (multiple filters)
- Parameter names match frontend query strings
- Applied before serialization

#### Multi-select choice filter patterns

**MultiSelectField stored as comma-separated tokens** (e.g. `genre`, `language_description_type`):
- Split comma-separated param; validate against choice constants
- Filter with regex token match: `(^|,)value(,|$)` per selected token; OR across tokens

**Single-value choice field** (e.g. `resource_type`, `original_format_medium`):
- Split comma-separated param; validate against choice constants
- Filter with `field__in=selected_values` (OR semantics)

**Legacy invalid choice values:** Exclude from UI menus; ignore if sent in API param (do not error).

**Collection MultiSelectField with "Not specified":** Same token-OR regex for non-empty values; additionally match `field=''` or `field__isnull=True` when empty token selected. Frontend sends `access_levels=,` when only "Not specified" is chosen (django-filter skips bare empty CharFilter values).

#### Date range filters (computed min/max)

**Item creation dates:** `creation_date_min` DateFilter (`gte`), `creation_date_max` DateFilter (`lte`) on item computed fields.

**Collection date range:** Same pattern on aggregated fields — `date_range_min` (`gte`), `date_range_max` (`lte`). Display `date_range` CharField is for table display and keyword search only, not structured list filtering.

```python
date_range_min = DateFilter(field_name='date_range_min', lookup_expr='gte')
date_range_max = DateFilter(field_name='date_range_max', lookup_expr='lte')
```

**Frontend:** Two separate `type="date"` fields (From/To), same `Object.entries` map pattern as Items.

#### Item collection filter (FK-only)

`collection_contains` searches associated `Collection` FK only:
```python
queryset.filter(collection__isnull=False).filter(
    Q(collection__collection_abbr__icontains=value) |
    Q(collection__name__icontains=value)
).distinct()
```

**Do not** search legacy `Item.collection_name` CharField. Batch serializer exposes FK-derived `collection_name` / `collection_abbr` for client-side cache parity.

#### Keyword filters (Collaborator, Collection)

Both use `keyword_contains` CharFilter with custom `filter_keyword` methods — cross-field OR search including related M2M names where applicable. Collaborator also matches numeric `collaborator_id` when search term is all digits.

#### CollectionFilter (internal list API only)

**Scope:** `CollectionFilter` in `app/internal_api/views.py` is wired only to `InternalCollectionViewSet` (React list + `collection_abbr` exact for detail uniqueness check). Not the public API `CollectionFilter` in `app/api/v1/views/collections.py` or map `CollectionFilterBackend`.

**Field-type model (2026-05-23):**

| Type | Collection fields | Filter pattern |
|---|---|---|
| Text | abbr, name, extent, abstract, description, citation_authors | `{field}_contains` + icontains |
| MultiSelect | `genres`, `access_levels` | `{field}` param + token-OR regex (Genre pattern); plural names reflect item aggregation |
| Computed dates | `date_range_min`, `date_range_max` | DateFilter gte/lte (Item creation-date pattern) |
| M2M | languages | `languages_contains` + `.distinct()` |
| Cross-field | — | `keyword_contains` |

**Do not** use `icontains` on MultiSelectField params for structured filters — breaks multi-select OR semantics.

M2M joins require `.distinct()` on queryset when `languages_contains` or `keyword_contains` is used.

#### Empty-field filters

Boolean `*_isnull` params find NULL or empty string (CharField) or empty M2M (Collaborator). Item list trimmed empty toggles to those with meaningful data gaps (9 remain as of 2026-05).

**Deprecated example below** — internal API uses FilterSet, not BaseFilterBackend:

```python
# OLD PATTERN — do not use for internal list ViewSets
class ItemFilter(BaseFilterBackend):
    def filter_queryset(self, request, queryset, view):
        keyword = request.query_params.get('keyword')
        ...
```

#### Map API Filter Backends

Three filter backends are used for the public map API (`app/api/filters.py`):

**BoundingBoxFilterBackend**: Filters by geographic bounding box
- Parameter: `bbox` (required): `west,south,east,north`
- Implementation: `queryset.filter(latitude__gte=south, latitude__lte=north, ...)`

**DensityFilterBackend**: Optional zoom-based sampling for performance
- Parameter: `zoom` (optional): 0–20
- Sampling ratios: `zoom < 6` = 10%, `zoom 6–9` = 33%, `zoom >= 10` = 100%
- Implementation: `MOD(metadata_item.id, N)` for deterministic sampling
- **CRITICAL**: Must use fully qualified table name `metadata_item.id` (not just `id`) in the MOD expression to avoid ambiguous column errors when JOINs are present

**CollectionFilterBackend**: Filters by collection abbreviation
- Parameter: `collection` (optional): comma-separated abbreviations (e.g., `ACH,NAL`)
- Implementation: `queryset.filter(collection__collection_abbr__in=[...])`

**Registration**: `filter_backends = [BoundingBoxFilterBackend, DensityFilterBackend, ...]` (order matters)

### Case-Insensitive Sorting

**Always use** `Lower()` for text field sorting:

```python
from django.db.models.functions import Lower

queryset = Item.objects.all().order_by(Lower('catalog_number'))
```

**Why**: Default is case-sensitive ("Zebra" before "apple")

### Prefetch Related

**Always use** for M2M and reverse FK to avoid N+1:

```python
queryset = Item.objects.prefetch_related(
    'language',                              # M2M
    'title_item',                           # Reverse FK
    'title_item__language',                 # Nested FK
    'item_collaboratorroles__collaborator'  # Reverse FK + nested
)
```

**Impact**: Export time: Minutes without - Seconds with (for 4,400 items)

---

## Field Validation

### Date Field Standardization

**Pattern**: Signal converts flexible input to standard format

```python
@receiver(pre_save, sender=Item)
def standardize_item_dates(sender, instance, **kwargs):
    if instance.creation_date:
        instance.creation_date = standardize_date_format(instance.creation_date)
    # ... other date fields

def standardize_date_format(date_str: str) -> str:
    """Convert MM/DD/YYYY to YYYY/MM/DD"""
    # Handle single dates
    match = re.match(r'^(\d{1,2})/(\d{1,2})/(\d{4})$', date_str)
    if match:
        month, day, year = match.groups()
        return f"{year}/{month.zfill(2)}/{day.zfill(2)}"
    
    # Handle ranges MM/YYYY-MM/YYYY
    match = re.match(r'^(\d{1,2})/(\d{4})-(\d{1,2})/(\d{4})$', date_str)
    if match:
        m1, y1, m2, y2 = match.groups()
        return f"{y1}/{m1.zfill(2)}-{y2}/{m2.zfill(2)}"
    
    # Already standard or approximate (keep as-is)
    return date_str
```

#### Date Field Architecture (Why Two Layers)

The system uses a **two-layer** architecture:
1. **DRF serializer** `validate_<field>` methods — catches input from the React frontend
2. **`pre_save` signal** `standardize_item_dates` — catches input from Django admin and direct model saves

This is intentional. Dates are stored as `CharField` with flexible user-friendly formats (see accepted formats below) and automatically standardized to YYYY-first format for search compatibility.

**Accepted formats**:
- Years: `2023`, `1990s`, `1990s?`, `2020-2025`
- Months: `2023/03`, `March 2023`, `3/2023`
- Full dates: `2023/03/15`, `3/15/2023`
- Date ranges: `2020/03-2023/10`, `1/2020-3/2021`, `2020-2023`
- Approximate: `ca 2023`, `19th century`, `early 2020s`
- Partial/uncertain: `2023?`, `Spring 2023`, `circa 1950`

**Conversions performed** (extracted from existing management command):
- `MM/DD/YYYY → YYYY/MM/DD`
- `MM/YYYY → YYYY/MM`
- `MM/YYYY-MM/YYYY → YYYY/MM-YYYY/MM`
- `MM/DD/YYYY-MM/DD/YYYY → YYYY/MM/DD-YYYY/MM/DD`
- YYYY-first formats preserved as-is

**Original design intent**: "Carrot approach" — users who entered proper YYYY formats got search functionality; MM/DD formats didn't benefit from search. The management command did a one-time batch conversion. The React frontend transition added automatic conversion so users no longer need to think about format.

**Why field validators don't work for transformation**: Django field validators that return transformed values are ignored — the transformation never propagates. Always use serializer `validate_<field>` methods or `pre_save` signals for transformation.

**UI**: `DateFormatHelp` component appears conditionally when editing date fields (`editingFields.has(fieldName)`). Shows blue info box with example formats.

### DecimalField Validation

**Pattern**: Validate after deserialization

```python
# In ViewSet custom action
@action(detail=False, methods=['post'])
def validate_field(self, request):
    field_name = request.data.get('field')
    value = request.data.get('value')
    
    serializer = self.get_serializer()
    field = serializer.fields.get(field_name)
    
    try:
        # Deserialize first (string to Decimal)
        validated_value = field.run_validation(value)
        
        # Then validate (expects Decimal, not string)
        validate_method = getattr(serializer, f'validate_{field_name}', None)
        if validate_method:
            validate_method(validated_value)  # NOT value
        
        return Response({'valid': True})
    except Exception as e:
        return Response({'valid': False, 'error': str(e)})
```

**Critical**: Pass deserialized value to `validate_<field>` methods, not raw string.

---

## Celery Task Patterns

### Export Task

**See**: `batch-editors.md` for complete template

**Key Points**:
- Use UUID for export_id (uniqueness)
- Atomic write (temp file + validate + rename)
- File size validation (prevent corrupted files)
- Return error dict, not raise self.retry()

### Cache Warming Task

```python
@shared_task(bind=True, max_retries=3)
def warm_item_list_cache(self):
    try:
        queryset = Item.objects.all()
        queryset = queryset.prefetch_related('language', 'title_item', ...)
        queryset = queryset.order_by(Lower('catalog_number'))
        
        serializer = InternalItemBatchSerializer(queryset, many=True)
        
        cache_key = 'item_list_full'
        cache.set(cache_key, json.dumps(serializer.data), timeout=3600)
        
        logger.info(f"Cache warmed: {queryset.count()} items")
        return {'status': 'success', 'count': queryset.count()}
        
    except Exception as e:
        logger.error(f"Cache warming failed: {e}")
        return {'status': 'error', 'error': str(e)}
```

### Hierarchy Update Task

**Complex example** (Languoid):

```python
@shared_task(bind=True, max_retries=3)
def update_languoid_hierarchy_task(self, languoid_id, old_parent_id=None):
    try:
        languoid = Languoid.objects.get(id=languoid_id)
        
        # STEP 1: Orphan dialects if needed
        if hasattr(languoid, '_needs_dialect_orphaning'):
            Languoid.objects.filter(
                parent_languoid=languoid,
                level_glottolog='dialect'
            ).update(parent_languoid=None)
        
        # STEP 2: Update descendents for new parent chain
        ancestors = get_all_ancestors(languoid)
        descendents = get_all_descendents(languoid)
        
        for ancestor in ancestors:
            ancestor.descendents.set(descendents)
        
        # STEP 3: Update descendents for old parent chain (if moved)
        if old_parent_id:
            old_parent = Languoid.objects.get(id=old_parent_id)
            old_ancestors = get_all_ancestors(old_parent)
            for ancestor in old_ancestors:
                # Recalculate without moved subtree
                ancestor.descendents.set(get_all_descendents(ancestor))
        
        return {'status': 'success'}
        
    except Exception as e:
        logger.error(f"Hierarchy update failed: {e}")
        return {'status': 'error', 'error': str(e)}
```

**Use For**: Complex multi-step updates with cascading effects.

---

## Database Patterns

### Query Optimization

**Select Related** (FK, OneToOne):
```python
queryset = Item.objects.select_related('collection', 'modified_by')
```

**Prefetch Related** (M2M, reverse FK):
```python
queryset = Item.objects.prefetch_related('language', 'title_item')
```

**Combined**:
```python
queryset = Item.objects.select_related('collection') \
                        .prefetch_related('language', 'title_item__language')
```

### Distinct() for Filtering

**Use** when filtering creates duplicate rows (JOIN):

```python
queryset = queryset.filter(
    Q(collaborator__first_names__icontains=keyword) |
    Q(collaborator__last_names__icontains=keyword)
).distinct()  # Remove duplicates from JOIN
```

### Bulk Operations

**Bulk Create**:
```python
items_to_create = [
    Item(catalog_number=f'TEST-{i}', ...) 
    for i in range(100)
]
Item.objects.bulk_create(items_to_create, batch_size=500)
```

**Bulk Update**:
```python
items = Item.objects.filter(id__in=ids)
for item in items:
    item.description = new_description
    
Item.objects.bulk_update(items, ['description'], batch_size=500)
```

**Critical**: Set `_skip_async_tasks = True` on instances to prevent cache invalidation:
```python
for item in items:
    item.description = new_description
    item._skip_async_tasks = True  # Prevent signal from invalidating cache

Item.objects.bulk_update(items, ['description'], batch_size=500)
```

---

## MultiSelectField Handling

**Problem**: Can be list or comma-separated string depending on context

**Solution**: Helper functions

```python
def to_list(value):
    """Convert to consistent list format"""
    if value is None or value == '':
        return []
    if isinstance(value, (list, tuple)):
        return list(value)
    if isinstance(value, str):
        return [v.strip() for v in value.split(',') if v.strip()]
    return [value]

def field_includes(field_value, check_value):
    """Check if value exists in MultiSelectField"""
    values = to_list(field_value)
    return check_value in values
```

**Usage**:
```python
# In signals
genre_list = to_list(instance.genre)
if field_includes(genre_list, 'primary-text'):
    categories.append('texts')

# In migrations
lang_desc_type = to_list(item.language_description_type)
if field_includes(lang_desc_type, 'grammar'):
    categories.append('grammars')
```

**Critical**: Use same helpers in signals AND migrations for consistency.

---

## URL Routing

### Production URL Pattern

**Order matters** - must be in `app/archive/urls.py`:

```python
urlpatterns = [
    # 1. Django admin (with trailing slash)
    path('admin/', admin.site.urls),
    
    # 2. API routes
    path('api/', include('app.api.urls')),
    path('internal/v1/', include('app.internal_api.urls')),
    
    # 3. Legacy Django templates
    path('django/', include('app.metadata.urls')),
    
    # 4. React home (exact match)
    path('', ReactAppView.as_view(), name='react_app'),
    
    # 5. Explicit redirects (without trailing slash)
    re_path(r'^admin$', lambda req: HttpResponsePermanentRedirect('/admin/')),
    re_path(r'^api$', lambda req: HttpResponsePermanentRedirect('/api/')),
    
    # 6. React catch-all (MUST BE LAST)
    re_path(r'^(?!admin/|api/|internal/|django/|static/|media/).*$', 
            ReactAppView.as_view()),
]
```

**Critical**:
- Backend routes before catch-all
- Explicit redirects handle no-slash URLs
- Negative lookahead in catch-all excludes backend prefixes

---

## Common Django Gotchas

### Field Validators Don't Transform

**Problem**: Field validators that return transformed values are ignored

**Wrong**:
```python
def my_validator(value):
    return value.upper()  # Ignored - transformation lost

class MyModel(models.Model):
    field = models.CharField(validators=[my_validator])
```

**Correct**: Use pre_save signal for transformations

```python
@receiver(pre_save, sender=MyModel)
def transform_field(sender, instance, **kwargs):
    if instance.field:
        instance.field = instance.field.upper()
```

### Save() Can Be Bypassed

**Problem**: `bulk_update()`, `queryset.update()` bypass model `save()` method

**Solution**: Use signals, not save() override, for derived fields

```python
# UNRELIABLE
def save(self, *args, **kwargs):
    self.full_name = compute_full_name()
    super().save(*args, **kwargs)

# RELIABLE
@receiver(pre_save, sender=MyModel)
def compute_derived(sender, instance, **kwargs):
    instance.full_name = compute_full_name()
```

### QuerySet Evaluation

**Lazy evaluation** - doesn't hit DB until needed:

```python
qs = Item.objects.filter(...)  # No DB query yet
qs = qs.exclude(...)           # Still no DB query
count = qs.count()             # NOW hits DB
```

**Force evaluation**:
- `list(qs)`
- `len(qs)`  (don't use - loads all objects)
- `qs.count()` (use this for counts)
- Iterate: `for item in qs:`

---

## Error Handling

### Structured Error Responses

```python
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

def my_view(request):
    try:
        result = do_something()
        return Response({'data': result})
        
    except ValidationError as e:
        return Response(
            {'error': 'Validation failed', 'details': e.detail},
            status=400
        )
    except PermissionDenied as e:
        return Response(
            {'error': 'Permission denied', 'message': str(e)},
            status=403
        )
    except Exception as e:
        logger.exception("Unexpected error")
        return Response(
            {'error': 'Server error'},
            status=500
        )
```

### Atomic Transactions

**Use** for multi-step operations:

```python
from django.db import transaction

@transaction.atomic
def save_with_relationships(item_data, collaborator_data):
    item = Item.objects.create(**item_data)
    
    for collab_data in collaborator_data:
        CollaboratorRole.objects.create(
            item=item,
            collaborator_id=collab_data['id'],
            roles=collab_data['roles']
        )
    
    return item
```

**Rollback** on any exception within block.

---

## Common Anti-Patterns

**Overriding save() for derived fields** (use signals)  
**Using raise self.retry() in tasks** (use return error dict)  
**Not using prefetch_related** for M2M (N+1 queries)  
**Case-sensitive sorting** (use Lower())  
**Field validators for transformations** (use signals)  
**Forgetting .distinct() after filter JOIN** (duplicate rows)  
**Using get_object_or_404 in tasks** (returns HTTP response, not for tasks)

---

**See also**:
- `batch-editors.md` - Export task template
- `frontend.md` - Frontend API calls
- `../01-ARCHITECTURE/system-overview.md` - Celery architecture
- `../01-ARCHITECTURE/data-models.md` - Signal architecture per model
