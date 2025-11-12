# Map API Endpoint Guide

## Overview

The Map API provides geographic data for visualizing archive items on interactive maps. It returns data in **GeoJSON format** - the industry standard for geographic APIs.

**Endpoint:** `/api/v1/map/items/`

**Format:** GeoJSON FeatureCollection (RFC 7946)

**Authentication:** Public (no authentication required)

**Total mappable items:** ~2,300 (52.5% of archive)

---

## Quick Start

### Basic Request

```bash
curl "https://archive.example.com/api/v1/map/items/?bbox=-98.5,35.0,-96.0,37.0"
```

### Response Structure

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [-97.516400, 35.467600]
      },
      "properties": {
        "id": 1,
        "catalog_number": "ACH-00001",
        "title": "Father's Day Naisha 'Manatidie' Chalepah Blackfoot Society",
        "resource_type": "audio",
        "access_level": "1",
        "collection_abbr": "ACH",
        "url": "/api/v1/items/1/"
      }
    }
  ]
}
```

---

## Required Parameters

### Bounding Box (`bbox`)

**Format:** `bbox=west,south,east,north`

The bounding box defines the geographic area to query. Coordinates must be in decimal degrees.

- **west:** minimum longitude (left edge)
- **south:** minimum latitude (bottom edge)  
- **east:** maximum longitude (right edge)
- **north:** maximum latitude (top edge)

**Example: Oklahoma City to Tulsa**
```
?bbox=-98.5,35.0,-96.0,37.0
```

**Example: Entire Oklahoma State**
```
?bbox=-103.0,33.6,-94.4,37.0
```

**Example: Norman, OK (city level)**
```
?bbox=-97.5,35.2,-97.4,35.3
```

---

## Optional Parameters

### Zoom Level (`zoom`)

**Format:** `zoom=8` (integer 0-20)

Controls point density at different zoom levels to improve performance.

**Zoom Scale:**
- `0-5`: World to continent view
- `6-9`: Country to state view  
- `10-14`: City to neighborhood view
- `15-20`: Street to building view

**Filtering Behavior:**
- `zoom < 6`: Returns ~10% of items (1 in 10)
- `zoom 6-9`: Returns ~33% of items (1 in 3)
- `zoom ≥ 10`: Returns all items

**When to use:**
- Large bounding boxes at low zoom (prevents 1000+ markers)
- State or regional views
- Not needed for city-level or closer zoom

**Example:**
```
?bbox=-103.0,33.6,-94.4,37.0&zoom=6
```

### Collection Filter (`collection`)

**Format:** `collection=ACH` or `collection=ACH,NAL`

Filter items by collection abbreviation. Comma-separated for multiple collections.

**Single collection:**
```
?bbox=-98.5,35.0,-96.0,37.0&collection=ACH
```

**Multiple collections:**
```
?bbox=-98.5,35.0,-96.0,37.0&collection=ACH,NAL
```

---

## Client-Side Clustering (Recommended)

For optimal map performance, use client-side clustering libraries. These handle thousands of markers efficiently with zoom-aware grouping.

### Leaflet + Leaflet.markercluster

**Installation:**
```bash
npm install leaflet leaflet.markercluster
npm install @types/leaflet @types/leaflet.markercluster
```

**React Example:**
```typescript
import L from 'leaflet';
import 'leaflet.markercluster';
import { useEffect, useRef } from 'react';

function MapComponent() {
  const mapRef = useRef<L.Map | null>(null);
  
  useEffect(() => {
    // Initialize map
    const map = L.map('map').setView([35.5, -97.5], 7);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    // Create marker cluster group
    const markers = L.markerClusterGroup();
    
    // Fetch data when map moves
    const updateMarkers = async () => {
      const bounds = map.getBounds();
      const bbox = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth()
      ].join(',');
      
      const zoom = map.getZoom();
      
      const response = await fetch(
        `/api/v1/map/items/?bbox=${bbox}&zoom=${zoom}`
      );
      const geojson = await response.json();
      
      // Clear existing markers
      markers.clearLayers();
      
      // Add markers from GeoJSON
      geojson.features.forEach(feature => {
        const [lng, lat] = feature.geometry.coordinates;
        const marker = L.marker([lat, lng]);
        
        marker.bindPopup(`
          <strong>${feature.properties.catalog_number}</strong><br>
          ${feature.properties.title}<br>
          <a href="${feature.properties.url}">View Details</a>
        `);
        
        markers.addLayer(marker);
      });
      
      map.addLayer(markers);
    };
    
    map.on('moveend', updateMarkers);
    updateMarkers();
    
    mapRef.current = map;
    
    return () => {
      map.remove();
    };
  }, []);
  
  return <div id="map" style={{ height: '600px' }} />;
}
```

### MapBox GL JS + Supercluster

**Installation:**
```bash
npm install mapbox-gl supercluster
```

**Example:**
```javascript
import mapboxgl from 'mapbox-gl';
import Supercluster from 'supercluster';

mapboxgl.accessToken = 'YOUR_MAPBOX_TOKEN';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/streets-v11',
  center: [-97.5, 35.5],
  zoom: 7
});

// Fetch all data once (bounding box covers entire region)
fetch('/api/v1/map/items/?bbox=-103,33,-94,37')
  .then(res => res.json())
  .then(geojson => {
    // Initialize Supercluster
    const cluster = new Supercluster({
      radius: 60,
      maxZoom: 16
    });
    
    cluster.load(geojson.features);
    
    // Update clusters on zoom/pan
    const updateClusters = () => {
      const bounds = map.getBounds();
      const zoom = map.getZoom();
      
      const clusters = cluster.getClusters(
        [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
        Math.floor(zoom)
      );
      
      // Add clusters and markers to map
      // ... implementation
    };
    
    map.on('moveend', updateClusters);
    updateClusters();
  });
```

---

## Performance Best Practices

### 1. Request Only Visible Area

Always use bounding box based on the visible map viewport:

```javascript
const bounds = map.getBounds();
const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;
```

### 2. Use Zoom Parameter for Large Areas

When showing state or regional views (zoom < 10), include zoom parameter:

```javascript
const zoom = map.getZoom();
const url = `/api/v1/map/items/?bbox=${bbox}&zoom=${zoom}`;
```

### 3. Debounce Map Move Events

Prevent excessive API calls when user drags the map:

```javascript
let timeout;
map.on('moveend', () => {
  clearTimeout(timeout);
  timeout = setTimeout(updateMarkers, 300);
});
```

### 4. Cache Responses

Cache API responses by bounding box to avoid duplicate requests:

```javascript
const cache = new Map();

async function fetchMapData(bbox, zoom) {
  const key = `${bbox}-${zoom}`;
  
  if (cache.has(key)) {
    return cache.get(key);
  }
  
  const response = await fetch(`/api/v1/map/items/?bbox=${bbox}&zoom=${zoom}`);
  const data = await response.json();
  
  cache.set(key, data);
  return data;
}
```

---

## Common Integration Patterns

### Pattern 1: Load on Demand (Recommended)

Load data as user pans/zooms the map:

```javascript
map.on('moveend', () => {
  const bounds = map.getBounds();
  const bbox = [bounds.getWest(), bounds.getSouth(), 
                bounds.getEast(), bounds.getNorth()].join(',');
  const zoom = map.getZoom();
  
  fetch(`/api/v1/map/items/?bbox=${bbox}&zoom=${zoom}`)
    .then(res => res.json())
    .then(data => updateMapMarkers(data));
});
```

**Pros:**
- Only loads visible data
- Handles large datasets efficiently
- Works well with zoom density filtering

**Cons:**
- Multiple API requests as user explores
- Requires debouncing

### Pattern 2: Load Once + Client Clustering

Load all data once, cluster on client:

```javascript
// Load entire region once
fetch('/api/v1/map/items/?bbox=-103,33,-94,37')
  .then(res => res.json())
  .then(geojson => {
    // Use Supercluster or similar for client-side clustering
    initializeClustering(geojson);
  });
```

**Pros:**
- Single API request
- Instant pan/zoom (no loading)
- Works offline after initial load

**Cons:**
- Larger initial payload (~2,300 items)
- More client memory usage

### Pattern 3: Collection-Specific Maps

Show maps for specific collections:

```javascript
const collection = 'ACH';
fetch(`/api/v1/map/items/?bbox=${bbox}&collection=${collection}`)
  .then(res => res.json())
  .then(data => createCollectionMap(data));
```

---

## Error Handling

### Missing Bounding Box

**Request:**
```
/api/v1/map/items/
```

**Response:** `200 OK` with empty FeatureCollection
```json
{
  "type": "FeatureCollection",
  "features": []
}
```

### Invalid Bounding Box

**Request:**
```
/api/v1/map/items/?bbox=invalid
```

**Response:** `200 OK` with empty FeatureCollection

### Out of Range Coordinates

**Request:**
```
/api/v1/map/items/?bbox=-200,100,200,-100
```

**Response:** `200 OK` with empty FeatureCollection

**Note:** The API gracefully handles invalid parameters by returning empty results rather than errors. This prevents map application crashes.

---

## GeoJSON Compatibility

The response follows **RFC 7946** (GeoJSON specification):

✅ Compatible with:
- Leaflet
- MapBox GL JS
- Google Maps JavaScript API
- OpenLayers
- QGIS
- ArcGIS
- PostGIS

✅ Standard features:
- FeatureCollection wrapper
- Point geometries
- Properties object for metadata
- Coordinates in [longitude, latitude] order

---

## Interactive API Documentation

Explore and test the API interactively:

- **Swagger UI:** `https://archive.example.com/api/docs/`
- **ReDoc:** `https://archive.example.com/api/redoc/`

Both provide:
- Live API testing
- Parameter validation
- Example requests/responses
- OpenAPI schema download

---

## Support

For questions or issues:

1. Check interactive API docs at `/api/docs/`
2. Review this guide for common patterns
3. Contact archive technical team

---

## Changelog

**v1.0** (2025-11-12)
- Initial release
- GeoJSON format
- Bounding box filtering
- Zoom-level density control
- Collection filtering
- ~2,300 mappable items

