"""
Serializers for map API endpoints.

Provides GeoJSON format for geographic data visualization.
"""
from rest_framework import serializers
from metadata.models import Item


class ItemMapSerializer(serializers.ModelSerializer):
    """
    Custom GeoJSON serializer for map markers.
    
    Returns items in GeoJSON Feature format (RFC 7946) with minimal fields
    optimized for map display.
    
    Title Logic:
    - Uses ItemTitle record with default=True for each item
    - Falls back to catalog_number if no default title exists
    - ~79% of mappable items (1,816/2,307) have ItemTitle records
    
    GeoJSON Feature structure:
    {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [longitude, latitude]
        },
        "properties": {
            "id": 1234,
            "catalog_number": "ACH-00123",
            "title": "Recording Title",
            "resource_type": "audio",
            "access_level": "1",
            "collection_abbr": "ACH",
            "url": "/api/v1/items/1234/"
        }
    }
    """
    
    # Add computed fields
    collection_abbr = serializers.CharField(
        source='collection.collection_abbr',
        read_only=True,
        allow_null=True
    )
    
    title = serializers.SerializerMethodField()
    url = serializers.SerializerMethodField()
    access_level = serializers.CharField(source='item_access_level', read_only=True)
    
    class Meta:
        model = Item
        fields = [
            'id',
            'catalog_number',
            'title',
            'resource_type',
            'access_level',
            'collection_abbr',
            'url',
            'latitude',
            'longitude'
        ]
    
    def get_title(self, obj):
        """
        Get the default title from ItemTitle model.
        Falls back to catalog_number if no default title exists.
        """
        try:
            # Get the ItemTitle with default=True
            default_title = obj.title_item.filter(default=True).first()
            if default_title:
                return default_title.title
        except:
            pass
        
        # Fallback to catalog number if no default title
        return obj.catalog_number
    
    def get_url(self, obj):
        """Generate URL to full item detail endpoint."""
        request = self.context.get('request')
        if request:
            try:
                return request.build_absolute_uri(f'/api/v1/items/{obj.id}/')
            except:
                # Fall back to relative URL if build_absolute_uri fails
                return f'/api/v1/items/{obj.id}/'
        return f'/api/v1/items/{obj.id}/'
    
    def to_representation(self, instance):
        """
        Override to convert to GeoJSON Feature format.
        
        Transforms Django model data into GeoJSON Feature with separate
        geometry and properties sections.
        """
        # Get standard serialized data
        data = super().to_representation(instance)
        
        # Extract coordinates
        latitude = data.pop('latitude')
        longitude = data.pop('longitude')
        
        # Build GeoJSON Feature
        return {
            'type': 'Feature',
            'geometry': {
                'type': 'Point',
                'coordinates': [longitude, latitude]  # GeoJSON uses [lng, lat] order
            },
            'properties': data
        }


class ItemMapFeatureCollectionSerializer(serializers.Serializer):
    """
    Wraps multiple GeoJSON Features into a FeatureCollection.
    
    This is used by the viewset's list() method to wrap the results.
    """
    
    def to_representation(self, instance):
        """
        Convert queryset to GeoJSON FeatureCollection.
        
        Args:
            instance: QuerySet of Item objects
            
        Returns:
            GeoJSON FeatureCollection with all features
        """
        # Serialize each item as a Feature
        serializer = ItemMapSerializer(
            instance, 
            many=True,
            context=self.context
        )
        
        return {
            'type': 'FeatureCollection',
            'features': serializer.data
        }

