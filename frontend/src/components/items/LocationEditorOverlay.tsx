import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Divider,
  CircularProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Paper,
  Alert,
  Stack,
} from '@mui/material';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import { debounce } from 'lodash';
import 'leaflet/dist/leaflet.css';
import '../../utils/leafletConfig';

interface LocationEditorOverlayProps {
  open: boolean;
  onClose: () => void;
  onSave: (locationData: LocationData) => Promise<void>;
  initialData: LocationData;
}

export interface LocationData {
  municipality_or_township: string;
  county_or_parish: string;
  state_or_province: string;
  country_or_territory: string;
  global_region: string;
  latitude: number | null;
  longitude: number | null;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address: {
    village?: string;
    town?: string;
    city?: string;
    municipality?: string;
    county?: string;
    parish?: string;
    state?: string;
    province?: string;
    country?: string;
    [key: string]: string | undefined;
  };
}

/**
 * MapClickHandler for the overlay map
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
 * LocationEditorOverlay - Comprehensive location and coordinate editing overlay
 * 
 * Features:
 * - Address search using Nominatim (OpenStreetMap)
 * - Manual address field editing
 * - Interactive map with click-to-set coordinates
 * - Manual coordinate entry
 * - All changes saved together on "Save" button click
 */
const LocationEditorOverlay: React.FC<LocationEditorOverlayProps> = ({
  open,
  onClose,
  onSave,
  initialData,
}) => {
  // Form state
  const [formData, setFormData] = useState<LocationData>(initialData);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [tempMarker, setTempMarker] = useState<{ lat: number; lng: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref for the temporary marker to control popup
  const tempMarkerRef = useRef<any>(null);

  // Update form data when initialData changes (dialog opens)
  React.useEffect(() => {
    if (open) {
      setFormData(initialData);
      setSearchQuery('');
      setSearchResults([]);
      setTempMarker(null);
      setError(null);
    }
  }, [open, initialData]);

  // Debounced geocoding search
  const performSearch = useCallback(
    debounce(async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?` +
          `format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`,
          {
            headers: {
              'User-Agent': 'ArchiveManagementSystem/1.0',
            },
          }
        );

        if (!response.ok) {
          throw new Error('Geocoding service error');
        }

        const data: NominatimResult[] = await response.json();
        setSearchResults(data);
      } catch (err) {
        console.error('Geocoding search failed:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500),
    []
  );

  // Handle search query change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    performSearch(query);
  };

  // Handle selecting a search result
  const handleSelectResult = (result: NominatimResult) => {
    const addr = result.address;
    
    setFormData({
      municipality_or_township: addr.village || addr.town || addr.city || addr.municipality || '',
      county_or_parish: addr.county || addr.parish || '',
      state_or_province: addr.state || addr.province || '',
      country_or_territory: addr.country || '',
      global_region: formData.global_region, // Keep existing global_region (not in Nominatim)
      latitude: parseFloat(result.lat),
      longitude: parseFloat(result.lon),
    });

    setSearchQuery('');
    setSearchResults([]);
  };

  // Handle manual field changes
  const handleFieldChange = (field: keyof LocationData, value: string | number | null) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
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
  const handleSetCoordinates = () => {
    if (tempMarker) {
      setFormData((prev) => ({
        ...prev,
        latitude: tempMarker.lat,
        longitude: tempMarker.lng,
      }));
      setTempMarker(null);
    }
  };

  // Handle save
  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onSave(formData);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save location data');
    } finally {
      setIsSaving(false);
    }
  };

  // Map configuration
  const defaultCenter: [number, number] = [39.8283, -98.5795]; // US center
  
  // Convert coordinates to numbers (they might come as strings from API)
  const lat = formData.latitude !== null ? Number(formData.latitude) : null;
  const lon = formData.longitude !== null ? Number(formData.longitude) : null;
  
  const hasCoordinates = lat !== null && lon !== null && !isNaN(lat) && !isNaN(lon);
  const mapCenter: [number, number] = hasCoordinates
    ? [lat!, lon!]
    : defaultCenter;
  const mapZoom = hasCoordinates ? 4 : 4;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: { minHeight: '80vh' }
      }}
    >
      <DialogTitle>
        <Typography variant="h5" component="div">
          Edit Location & Coordinates
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
          {/* Left Column: Address Section */}
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" gutterBottom color="primary">
              Address
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {/* Search Bar */}
            <Box sx={{ mb: 3 }}>
              <TextField
                fullWidth
                label="Search for an address"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="e.g., Smithsonian, Washington DC"
                helperText="Search for a known location to auto-populate fields"
                InputProps={{
                  endAdornment: isSearching && <CircularProgress size={20} />,
                }}
              />

              {/* Search Results */}
              {searchResults.length > 0 && (
                <Paper sx={{ mt: 1, maxHeight: 200, overflow: 'auto' }}>
                  <List dense>
                    {searchResults.map((result) => (
                      <ListItem key={result.place_id} disablePadding>
                        <ListItemButton onClick={() => handleSelectResult(result)}>
                          <ListItemText
                            primary={result.display_name}
                            primaryTypographyProps={{ variant: 'body2' }}
                          />
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              )}
            </Box>

            {/* Address Fields */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                fullWidth
                label="Municipality or Township"
                value={formData.municipality_or_township}
                onChange={(e) => handleFieldChange('municipality_or_township', e.target.value)}
              />
              <TextField
                fullWidth
                label="County or Parish"
                value={formData.county_or_parish}
                onChange={(e) => handleFieldChange('county_or_parish', e.target.value)}
              />
              <TextField
                fullWidth
                label="State or Province"
                value={formData.state_or_province}
                onChange={(e) => handleFieldChange('state_or_province', e.target.value)}
              />
              <TextField
                fullWidth
                label="Country or Territory"
                value={formData.country_or_territory}
                onChange={(e) => handleFieldChange('country_or_territory', e.target.value)}
              />
              <TextField
                fullWidth
                label="Global Region"
                value={formData.global_region}
                onChange={(e) => handleFieldChange('global_region', e.target.value)}
                helperText="Not auto-populated by search"
              />
            </Box>
          </Box>

          {/* Right Column: Map Section */}
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" gutterBottom color="primary">
              Coordinates
            </Typography>
            <Divider sx={{ mb: 2 }} />

            {/* Map */}
            <Box sx={{ height: 300, mb: 2, borderRadius: 1, overflow: 'hidden' }}>
              <MapContainer
                key={`${mapCenter[0]}-${mapCenter[1]}`} // Force re-render on center change
                center={mapCenter}
                zoom={mapZoom}
                scrollWheelZoom={true}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                <MapClickHandler onMapClick={handleMapClick} />

                {/* Current coordinates marker */}
                {hasCoordinates && (
                  <Marker position={[lat!, lon!]}>
                    <Popup>
                      <strong>Current Location</strong>
                      <br />
                      Lat: {lat!.toFixed(6)}
                      <br />
                      Lon: {lon!.toFixed(6)}
                    </Popup>
                  </Marker>
                )}

                {/* Temporary marker */}
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

            {/* Coordinate Fields */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                fullWidth
                label="Latitude"
                type="number"
                value={formData.latitude ?? ''}
                onChange={(e) => 
                  handleFieldChange('latitude', e.target.value ? parseFloat(e.target.value) : null)
                }
                helperText="Range: -90 to 90"
                inputProps={{ step: 0.000001 }}
              />
              <TextField
                fullWidth
                label="Longitude"
                type="number"
                value={formData.longitude ?? ''}
                onChange={(e) => 
                  handleFieldChange('longitude', e.target.value ? parseFloat(e.target.value) : null)
                }
                helperText="Range: -180 to 180"
                inputProps={{ step: 0.000001 }}
              />
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          disabled={isSaving}
          startIcon={isSaving && <CircularProgress size={20} />}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LocationEditorOverlay;

