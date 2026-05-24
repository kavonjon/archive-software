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

### Leaflet icon fix

Leaflet's default marker icons are broken in React builds due to webpack asset handling. Fixed in `leafletConfig.ts`:

```typescript
// frontend/src/leafletConfig.ts
import L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconShadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl,
  iconRetinaUrl: iconUrl,
  shadowUrl: iconShadowUrl,
});
```

**Import this file** once at the app entry point. Without it, markers show as broken images.

## Validation (geo_004)

- Lat/lng range, max 16 decimal places, max 22 total digits, valid number, empty allowed.
- Independent validation state per field; MUI Alert feedback; block save when invalid.

## Nominatim / overlay (session doc)

- Address search and reverse geocode integration per `system-overview.md` (User-Agent policy, debouncing).

---

## Related

- `02-PATTERNS/frontend.md` (stub pointer)
- `01-ARCHITECTURE/data-models.md` (coordinates on Item/Languoid)
