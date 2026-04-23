# Geographic features (Item and Languoid)

**Context note (2025-11-12, revised periodically):** Map and coordinate behavior for items and languoids (Leaflet, validation, Nominatim tie-ins).

---

## Backend (geo_001)

- Expose `latitude` / `longitude` on serializers: `DecimalField(max_digits=22, decimal_places=16, required=False, allow_null=True)`.
- Validators: `validate_latitude` (-90..90), `validate_longitude` (-180..180).
- JSON may serialize decimals as strings; frontend may need `Number()` where appropriate.

## Item detail location fields (geo_002)

- Editable text fields: municipality, county, state, country, global_region, recording_context, public_event (EditableTextField pattern).
- Editability gated by `hasEditAccess()`.

## Map card (geo_003)

- **Components:** `CoordinatesMapCard.tsx`, `leafletConfig.ts`; Leaflet + react-leaflet; OSM tiles.
- **Behavior:** default center US-wide when no coords; blue marker when coords exist; **click map** sets temporary red marker + popup “Set Coordinates”; manual lat/lng fields; `MapUpdater` uses `flyTo` when center changes.
- **Icons:** webpack breaks default Leaflet icons—`leafletConfig.ts` sets explicit icon URLs.

## Validation (geo_004)

- Lat/lng range, max 16 decimal places, max 22 total digits, valid number, empty allowed.
- Independent validation state per field; MUI Alert feedback; block save when invalid.

## Nominatim / overlay (session doc)

- Address search and reverse geocode integration per `system-overview.md` and `frontend.md` (User-Agent policy, debouncing).

---

## Related

- `02-PATTERNS/frontend.md` (Leaflet icon fix)
- `01-ARCHITECTURE/data-models.md` (coordinates on Item/Languoid)
