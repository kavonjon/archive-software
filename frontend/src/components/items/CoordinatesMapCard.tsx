import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import { Card, CardContent, Typography, Divider, Box, Button, Alert } from '@mui/material';
import { EditableTextField } from '../common';
import 'leaflet/dist/leaflet.css';
import '../../utils/leafletConfig'; // Fix marker icon paths

interface CoordinatesMapCardProps {
  latitude: number | null;
  longitude: number | null;
  // Editable field props
  editingFields: Set<string>;
  savingFields: Set<string>;
  editValues: Record<string, any>;
  startEditing: (fieldName: string, currentValue: string) => void;
  cancelEditing: (fieldName: string) => void;
  saveField: (fieldName: string, value: any) => Promise<void>;
  updateEditValue: (fieldName: string, value: any) => void;
  saveBothCoordinates: (latitude: number, longitude: number) => Promise<void>;
}

/**
 * MapClickHandler - Component to handle map click events
 * Placed inside MapContainer to access map events
 */
interface MapClickHandlerProps {
  onMapClick: (lat: number, lng: number) => void;
}

const MapClickHandler: React.FC<MapClickHandlerProps> = ({ onMapClick }) => {
  useMapEvents({
    click: (e) => {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
};

/**
 * MapUpdater - Component to update map view when coordinates change
 * Placed inside MapContainer to access map instance
 */
interface MapUpdaterProps {
  center: [number, number];
  zoom: number;
}

const MapUpdater: React.FC<MapUpdaterProps> = ({ center, zoom }) => {
  const map = useMap();
  
  useEffect(() => {
    // Fly to new coordinates with animation
    map.flyTo(center, zoom, {
      duration: 1.5
    });
  }, [center, zoom, map]);
  
  return null;
};

/**
 * CoordinatesMapCard - Displays a map showing the item's coordinates
 * 
 * Phase 2: Read-only display with map ✓
 * Phase 3: Added editable coordinate fields ✓
 * Phase 4: Added click-to-set coordinates functionality ✓
 */
const CoordinatesMapCard: React.FC<CoordinatesMapCardProps> = ({
  latitude,
  longitude,
  editingFields,
  savingFields,
  editValues,
  startEditing,
  cancelEditing,
  saveField,
  updateEditValue,
  saveBothCoordinates,
}) => {
  // State for temporary marker when clicking on the map
  const [tempMarker, setTempMarker] = useState<{ lat: number; lng: number } | null>(null);
  
  // Ref for the temporary marker to control popup
  const tempMarkerRef = useRef<any>(null);

  // Validation state for coordinates
  const [latitudeValidation, setLatitudeValidation] = useState<{
    isValidating: boolean;
    error: string | null;
    isValid: boolean;
  }>({
    isValidating: false,
    error: null,
    isValid: true
  });

  const [longitudeValidation, setLongitudeValidation] = useState<{
    isValidating: boolean;
    error: string | null;
    isValid: boolean;
  }>({
    isValidating: false,
    error: null,
    isValid: true
  });

  // Convert coordinates to numbers (they might come as strings from API)
  const lat = latitude !== null ? Number(latitude) : null;
  const lon = longitude !== null ? Number(longitude) : null;

  // Default center: US (zoomed out)
  const defaultCenter: [number, number] = [39.8283, -98.5795];
  const defaultZoom = 4;

  // Determine map center and zoom
  const hasCoordinates = lat !== null && lon !== null && !isNaN(lat) && !isNaN(lon);
  const center: [number, number] = hasCoordinates 
    ? [lat!, lon!] 
    : defaultCenter;
  const zoom = hasCoordinates ? 4 : defaultZoom;

  // Validate latitude
  const validateLatitude = (value: string) => {
    if (!value.trim()) {
      setLatitudeValidation({
        isValidating: false,
        error: null,
        isValid: true
      });
      return;
    }

    const num = Number(value);
    if (isNaN(num)) {
      setLatitudeValidation({
        isValidating: false,
        error: 'Latitude must be a valid number',
        isValid: false
      });
      return;
    }

    if (num < -90 || num > 90) {
      setLatitudeValidation({
        isValidating: false,
        error: 'Latitude must be between -90 and 90',
        isValid: false
      });
      return;
    }

    // Check decimal precision (max 16 decimal places, max 22 total digits)
    const parts = value.split('.');
    if (parts.length > 1) {
      const decimalPlaces = parts[1].length;
      if (decimalPlaces > 16) {
        setLatitudeValidation({
          isValidating: false,
          error: 'Latitude cannot have more than 16 decimal places',
          isValid: false
        });
        return;
      }
    }

    // Check total digits (max 22)
    const totalDigits = value.replace(/[-.]/g, '').length;
    if (totalDigits > 22) {
      setLatitudeValidation({
        isValidating: false,
        error: 'Latitude cannot have more than 22 total digits',
        isValid: false
      });
      return;
    }

    setLatitudeValidation({
      isValidating: false,
      error: null,
      isValid: true
    });
  };

  // Validate longitude
  const validateLongitude = (value: string) => {
    if (!value.trim()) {
      setLongitudeValidation({
        isValidating: false,
        error: null,
        isValid: true
      });
      return;
    }

    const num = Number(value);
    if (isNaN(num)) {
      setLongitudeValidation({
        isValidating: false,
        error: 'Longitude must be a valid number',
        isValid: false
      });
      return;
    }

    if (num < -180 || num > 180) {
      setLongitudeValidation({
        isValidating: false,
        error: 'Longitude must be between -180 and 180',
        isValid: false
      });
      return;
    }

    // Check decimal precision (max 16 decimal places, max 22 total digits)
    const parts = value.split('.');
    if (parts.length > 1) {
      const decimalPlaces = parts[1].length;
      if (decimalPlaces > 16) {
        setLongitudeValidation({
          isValidating: false,
          error: 'Longitude cannot have more than 16 decimal places',
          isValid: false
        });
        return;
      }
    }

    // Check total digits (max 22)
    const totalDigits = value.replace(/[-.]/g, '').length;
    if (totalDigits > 22) {
      setLongitudeValidation({
        isValidating: false,
        error: 'Longitude cannot have more than 22 total digits',
        isValid: false
      });
      return;
    }

    setLongitudeValidation({
      isValidating: false,
      error: null,
      isValid: true
    });
  };

  // Handle map click
  const handleMapClick = (lat: number, lng: number) => {
    setTempMarker({ lat, lng });
  };

  // Auto-open popup when temporary marker is created
  useEffect(() => {
    if (tempMarker && tempMarkerRef.current) {
      // Use setTimeout to ensure marker is mounted before opening popup
      setTimeout(() => {
        if (tempMarkerRef.current) {
          tempMarkerRef.current.openPopup();
        }
      }, 0);
    }
  }, [tempMarker]);

  // Handle setting coordinates from temp marker
  const handleSetCoordinates = async () => {
    if (tempMarker) {
      // Store temp values and clear marker immediately to prevent flicker
      const newLat = tempMarker.lat;
      const newLng = tempMarker.lng;
      setTempMarker(null);
      
      // Use batch save to update both coordinates in a single API call
      // This prevents the map from re-rendering with partial updates
      await saveBothCoordinates(newLat, newLng);
    }
  };

  return (
    <Card sx={{ mb: 2 }} elevation={1}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium', color: 'primary.main' }}>
          Coordinates
        </Typography>
        <Divider sx={{ mb: 2 }} />
        
        {/* Map */}
        <Box sx={{ height: 300, mb: 2, borderRadius: 1, overflow: 'hidden' }}>
          <MapContainer
            center={center}
            zoom={zoom}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {/* Update map view when coordinates change */}
            <MapUpdater center={center} zoom={zoom} />
            
            {/* Map click handler */}
            <MapClickHandler onMapClick={handleMapClick} />
            
            {/* Existing item marker */}
            {hasCoordinates && (
              <Marker position={[lat!, lon!]}>
                <Popup>
                  <strong>Item Location</strong>
                  <br />
                  Lat: {lat!.toFixed(6)}
                  <br />
                  Lon: {lon!.toFixed(6)}
                </Popup>
              </Marker>
            )}
            
            {/* Temporary marker from map click */}
            {tempMarker && (
              <Marker 
                position={[tempMarker.lat, tempMarker.lng]}
                ref={tempMarkerRef}
              >
                <Popup>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      <strong>New Coordinates</strong>
                      <br />
                      Lat: {tempMarker.lat.toFixed(6)}
                      <br />
                      Lon: {tempMarker.lng.toFixed(6)}
                    </Typography>
                    <Button 
                      variant="contained" 
                      size="small" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetCoordinates();
                      }}
                      sx={{ mr: 1 }}
                    >
                      Set Coordinates
                    </Button>
                    <Button 
                      variant="outlined" 
                      size="small" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setTempMarker(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </Box>
                </Popup>
              </Marker>
            )}
          </MapContainer>
        </Box>

        {/* Editable coordinate fields */}
        <Box>
          <EditableTextField
            fieldName="latitude"
            label="Latitude"
            value={latitude !== null ? String(latitude) : ''}
            isEditing={editingFields.has('latitude')}
            isSaving={savingFields.has('latitude')}
            editValue={editValues.latitude !== undefined ? String(editValues.latitude) : ''}
            startEditing={startEditing}
            cancelEditing={(fieldName) => {
              cancelEditing(fieldName);
              setLatitudeValidation({ isValidating: false, error: null, isValid: true });
            }}
            saveField={(fieldName) => {
              if (latitudeValidation.isValid) {
                saveField(fieldName, editValues.latitude);
              }
            }}
            updateEditValue={updateEditValue}
            onValueChange={validateLatitude}
          />
          
          {/* Validation feedback for latitude */}
          {editingFields.has('latitude') && (
            <Box sx={{ mt: 1 }}>
              {latitudeValidation.error && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  {latitudeValidation.error}
                </Alert>
              )}
              
              {!latitudeValidation.error && editValues.latitude && latitudeValidation.isValid && (
                <Alert severity="success" sx={{ mt: 1 }}>
                  Latitude is valid
                </Alert>
              )}
            </Box>
          )}

          <EditableTextField
            fieldName="longitude"
            label="Longitude"
            value={longitude !== null ? String(longitude) : ''}
            isEditing={editingFields.has('longitude')}
            isSaving={savingFields.has('longitude')}
            editValue={editValues.longitude !== undefined ? String(editValues.longitude) : ''}
            startEditing={startEditing}
            cancelEditing={(fieldName) => {
              cancelEditing(fieldName);
              setLongitudeValidation({ isValidating: false, error: null, isValid: true });
            }}
            saveField={(fieldName) => {
              if (longitudeValidation.isValid) {
                saveField(fieldName, editValues.longitude);
              }
            }}
            updateEditValue={updateEditValue}
            onValueChange={validateLongitude}
          />
          
          {/* Validation feedback for longitude */}
          {editingFields.has('longitude') && (
            <Box sx={{ mt: 1 }}>
              {longitudeValidation.error && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  {longitudeValidation.error}
                </Alert>
              )}
              
              {!longitudeValidation.error && editValues.longitude && longitudeValidation.isValid && (
                <Alert severity="success" sx={{ mt: 1 }}>
                  Longitude is valid
                </Alert>
              )}
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default CoordinatesMapCard;

