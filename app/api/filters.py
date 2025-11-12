"""
Custom filter backends for API endpoints.
"""
from rest_framework import filters
from django.db.models import Q


class BoundingBoxFilterBackend(filters.BaseFilterBackend):
    """
    Filter items by geographic bounding box.
    
    Usage: ?bbox=west,south,east,north
    Example: ?bbox=-98.5,35.0,-96.0,37.0
    
    Bounding box format: west,south,east,north (longitude,latitude)
    - west: minimum longitude (leftmost edge)
    - south: minimum latitude (bottom edge)
    - east: maximum longitude (rightmost edge)
    - north: maximum latitude (top edge)
    """
    
    def filter_queryset(self, request, queryset, view):
        bbox = request.query_params.get('bbox')
        if not bbox:
            # Bounding box is required for map endpoint
            return queryset.none()
            
        try:
            west, south, east, north = map(float, bbox.split(','))
            
            # Validate bounding box
            if not (-180 <= west <= 180 and -180 <= east <= 180):
                return queryset.none()
            if not (-90 <= south <= 90 and -90 <= north <= 90):
                return queryset.none()
            if west >= east or south >= north:
                return queryset.none()
            
            # Filter by bounding box - only items with coordinates
            queryset = queryset.filter(
                latitude__gte=south,
                latitude__lte=north,
                longitude__gte=west,
                longitude__lte=east,
                latitude__isnull=False,
                longitude__isnull=False
            )
            
            return queryset
            
        except (ValueError, TypeError, AttributeError):
            # Invalid bbox format - return empty queryset
            return queryset.none()


class DensityFilterBackend(filters.BaseFilterBackend):
    """
    Filter by zoom level for density control at low zoom levels.
    
    Usage: ?zoom=8
    
    Zoom level scale: 0 (world view) to 20 (street level)
    
    At low zoom levels (zoomed out), this filter reduces point density
    by sampling items to prevent overwhelming the map with thousands of markers.
    At high zoom levels (zoomed in), all items in the bounding box are returned.
    
    Sampling strategy:
    - zoom < 6: Show ~10% of items (every 10th item by ID)
    - zoom 6-9: Show ~33% of items (every 3rd item by ID)
    - zoom >= 10: Show all items (no filtering)
    """
    
    def filter_queryset(self, request, queryset, view):
        zoom = request.query_params.get('zoom')
        if not zoom:
            # No zoom parameter - return all items
            return queryset
            
        try:
            zoom_level = int(zoom)
            
            # Validate zoom level
            if not 0 <= zoom_level <= 20:
                return queryset
            
            # Apply density filtering based on zoom level
            if zoom_level < 6:
                # Very zoomed out - show 1 in 10 items
                # Use modulo on ID for deterministic sampling
                queryset = queryset.extra(where=['MOD("metadata_item"."id", 10) = 0'])
                
            elif zoom_level < 10:
                # Moderately zoomed out - show 1 in 3 items
                queryset = queryset.extra(where=['MOD("metadata_item"."id", 3) = 0'])
                
            # else: zoom_level >= 10 - show all items (no filtering)
            
            return queryset
            
        except (ValueError, TypeError):
            # Invalid zoom value - return all items
            return queryset


class CollectionFilterBackend(filters.BaseFilterBackend):
    """
    Filter items by collection abbreviation.
    
    Usage: ?collection=ACH or ?collection=ACH,NAL
    
    Supports single or multiple collection abbreviations (comma-separated).
    Case-insensitive matching.
    """
    
    def filter_queryset(self, request, queryset, view):
        collection_param = request.query_params.get('collection')
        if not collection_param:
            return queryset
        
        # Split by comma and strip whitespace
        collection_abbrs = [c.strip().upper() for c in collection_param.split(',') if c.strip()]
        
        if not collection_abbrs:
            return queryset
        
        # Filter by collection abbreviation (case-insensitive)
        queryset = queryset.filter(
            collection__collection_abbr__in=collection_abbrs
        )
        
        return queryset

