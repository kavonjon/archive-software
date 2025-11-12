"""
Map API views for geographic data visualization.
"""
from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiExample, extend_schema_view
from drf_spectacular.types import OpenApiTypes

from metadata.models import Item
from api.filters import BoundingBoxFilterBackend, DensityFilterBackend, CollectionFilterBackend
from ..serializers.map import ItemMapSerializer, ItemMapFeatureCollectionSerializer


@extend_schema_view(
    list=extend_schema(
        summary="Get items for map display (GeoJSON)",
        description="""
        Returns items with geographic coordinates in GeoJSON FeatureCollection format,
        optimized for map visualization.
        
        ## Bounding Box Filtering (Required)
        
        Use the `bbox` parameter to request only items within a geographic area.
        
        **Format:** `bbox=west,south,east,north` (longitude, latitude)
        
        **Example:** `?bbox=-98.5,35.0,-96.0,37.0` (Oklahoma City to Tulsa region)
        
        Coordinates must be in decimal degrees:
        - Longitude (west/east): -180 to 180
        - Latitude (south/north): -90 to 90
        
        ## Zoom-Level Density Control (Optional)
        
        Use the `zoom` parameter to reduce point density at low zoom levels.
        
        **Format:** `zoom=8` (integer 0-20, where 0 is world view and 20 is street level)
        
        **Behavior:**
        - zoom < 6: Returns ~10% of items (sampled for performance)
        - zoom 6-9: Returns ~33% of items
        - zoom ≥ 10: Returns all items in bounding box
        
        ## Collection Filtering (Optional)
        
        Use the `collection` parameter to filter by collection abbreviation.
        
        **Format:** `collection=ACH` or `collection=ACH,NAL` (comma-separated)
        
        ## GeoJSON Format
        
        Response follows the GeoJSON specification (RFC 7946):
        - Industry-standard format for geographic data
        - Compatible with Leaflet, MapBox, Google Maps, QGIS, ArcGIS
        - Coordinates in [longitude, latitude] order
        
        ## Client-Side Clustering Recommended
        
        For optimal map performance, use client-side clustering libraries:
        - **Leaflet:** leaflet.markercluster
        - **MapBox:** supercluster
        - **Google Maps:** MarkerClusterer
        
        These libraries efficiently handle thousands of markers with zoom-aware clustering.
        
        ## Performance Notes
        
        - Total mappable items: ~2,300
        - Bounding box filtering is required for efficient queries
        - Request only visible map viewport for best performance
        - Zoom parameter helps at low zoom levels (entire state/region views)
        - Items without latitude/longitude are automatically excluded
        
        ## Example Usage
        
        **Oklahoma City area at street level:**
        ```
        /api/v1/map/items/?bbox=-97.6,35.4,-97.4,35.6&zoom=12
        ```
        
        **Entire Oklahoma state at state level, ACH collection only:**
        ```
        /api/v1/map/items/?bbox=-103.0,33.6,-94.4,37.0&zoom=6&collection=ACH
        ```
        """,
        parameters=[
            OpenApiParameter(
                name='bbox',
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                required=True,
                description='Bounding box: west,south,east,north (longitude,latitude)',
                examples=[
                    OpenApiExample(
                        'Oklahoma City to Tulsa',
                        value='-98.5,35.0,-96.0,37.0',
                        description='Central Oklahoma region'
                    ),
                    OpenApiExample(
                        'Oklahoma State',
                        value='-103.0,33.6,-94.4,37.0',
                        description='Entire state boundaries'
                    ),
                    OpenApiExample(
                        'Norman, OK (detailed)',
                        value='-97.5,35.2,-97.4,35.3',
                        description='City-level detail'
                    )
                ]
            ),
            OpenApiParameter(
                name='zoom',
                type=OpenApiTypes.INT,
                location=OpenApiParameter.QUERY,
                required=False,
                description='Zoom level (0-20) for density control. Lower zoom = fewer points returned.',
                examples=[
                    OpenApiExample(
                        'State view',
                        value=6,
                        description='Shows ~33% of items for state-level view'
                    ),
                    OpenApiExample(
                        'Regional view',
                        value=8,
                        description='Shows ~33% of items for regional view'
                    ),
                    OpenApiExample(
                        'City view',
                        value=12,
                        description='Shows all items at city level and closer'
                    )
                ]
            ),
            OpenApiParameter(
                name='collection',
                type=OpenApiTypes.STR,
                location=OpenApiParameter.QUERY,
                required=False,
                description='Filter by collection abbreviation. Comma-separated for multiple collections.',
                examples=[
                    OpenApiExample(
                        'Single collection',
                        value='ACH',
                        description='Oklahoma items only'
                    ),
                    OpenApiExample(
                        'Multiple collections',
                        value='ACH,NAL',
                        description='Oklahoma and NAL items'
                    )
                ]
            ),
        ],
        responses={
            200: {
                'description': 'GeoJSON FeatureCollection of items with geographic data',
                'content': {
                    'application/json': {
                        'example': {
                            'type': 'FeatureCollection',
                            'features': [
                                {
                                    'type': 'Feature',
                                    'geometry': {
                                        'type': 'Point',
                                        'coordinates': [-97.516400, 35.467600]
                                    },
                                    'properties': {
                                        'id': 1,
                                        'catalog_number': 'ACH-00001',
                                        'title': "Father's Day Naisha 'Manatidie' Chalepah Blackfoot Society",
                                        'resource_type': 'audio',
                                        'access_level': '1',
                                        'collection_abbr': 'ACH',
                                        'url': '/api/v1/items/1/'
                                    }
                                },
                                {
                                    'type': 'Feature',
                                    'geometry': {
                                        'type': 'Point',
                                        'coordinates': [-98.967300, 35.515600]
                                    },
                                    'properties': {
                                        'id': 2,
                                        'catalog_number': 'AHB-00001',
                                        'title': 'Interview Recording',
                                        'resource_type': 'audio',
                                        'access_level': '2',
                                        'collection_abbr': 'AHB',
                                        'url': '/api/v1/items/2/'
                                    }
                                }
                            ]
                        }
                    }
                }
            },
            400: {
                'description': 'Invalid parameters (missing bbox, invalid coordinates, etc.)'
            }
        }
    )
)
class ItemMapViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API endpoint for map data in GeoJSON format.
    
    Provides minimal item data optimized for map markers with geographic filtering.
    Only items with valid latitude/longitude coordinates are included.
    
    Filtering:
    - Bounding box (required): ?bbox=west,south,east,north
    - Zoom level (optional): ?zoom=0-20
    - Collection (optional): ?collection=ACH or ?collection=ACH,NAL
    """
    
    queryset = Item.objects.filter(
        latitude__isnull=False,
        longitude__isnull=False
    ).select_related('collection').prefetch_related('title_item')  # Optimize title and collection lookups
    
    serializer_class = ItemMapSerializer
    permission_classes = [AllowAny]  # Public API endpoint
    
    filter_backends = [
        BoundingBoxFilterBackend,
        DensityFilterBackend,
        CollectionFilterBackend
    ]
    
    pagination_class = None  # No pagination - return all items in bounding box
    
    def list(self, request, *args, **kwargs):
        """
        Override list to return GeoJSON FeatureCollection.
        """
        queryset = self.filter_queryset(self.get_queryset())
        
        # Use FeatureCollection serializer for list view
        serializer = ItemMapFeatureCollectionSerializer(
            queryset,
            context={'request': request}
        )
        
        return Response(serializer.data)

