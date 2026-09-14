import { ZONE_WEIGHTS, type FacilityKind } from '@gayatama/scoring';
import { divIcon } from 'leaflet';
import { Circle, CircleMarker, MapContainer, Marker, ScaleControl, TileLayer, Tooltip, useMapEvents } from 'react-leaflet';
import type { PoiFacility } from '../../lib/api-types';
import { FACILITY_KIND_LABELS } from '../../lib/copy';
import { formatDistance } from '../../lib/format';
import { USE_GOOGLE_MAP } from '../../lib/map-config';
import { usePois } from '../../lib/queries';
import { GoogleMapPicker } from './GoogleMapPicker';
import { PICK_COLOR, ZONE_RINGS, type MapPickerProps } from './zones';

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/**
 * Facility groups, coloured so the evidence behind a score is legible at a
 * glance: what creates demand, what competes, and what supports a transaction.
 */
const FACILITY_GROUPS = [
  {
    id: 'demand',
    label: 'Penarik pelanggan',
    color: '#2563eb',
    kinds: new Set<FacilityKind>([
      'campus',
      'school',
      'office',
      'government_office',
      'housing',
      'boarding_house',
      'transit',
      'hospital',
      'mall',
    ]),
  },
  {
    id: 'competitor',
    label: 'Usaha sejenis & pesaing',
    color: '#dc2626',
    kinds: new Set<FacilityKind>([
      'cafe',
      'bubble_tea',
      'restaurant',
      'fast_food',
      'food_court',
      'laundry',
      'dry_cleaning',
      'copyshop',
      'printer',
      'stationery_shop',
      'convenience',
      'supermarket',
      'hairdresser',
      'beauty',
      'pharmacy',
      'chemist',
    ]),
  },
  {
    id: 'support',
    label: 'Fasilitas pendukung',
    color: '#7c3aed',
    kinds: new Set<FacilityKind>(['atm', 'bank', 'marketplace', 'place_of_worship', 'clinic', 'parking']),
  },
] as const;

const FALLBACK_COLOR = '#94a3b8';

function facilityColor(kind: FacilityKind): string {
  return FACILITY_GROUPS.find((group) => group.kinds.has(kind))?.color ?? FALLBACK_COLOR;
}

/**
 * The point being analysed, drawn as a map pin rather than a dot. The teardrop
 * is a symbol people already read as this-place, so it needs no legend row —
 * and its tip marks the exact coordinate. Leaflet only: the Google map path
 * still draws its own simple marker (see GoogleMapPicker.tsx).
 */
const PICKED_PIN = divIcon({
  className: 'picked-pin',
  // The pulse sits behind the pin at the anchor point, so it rings the exact
  // coordinate rather than the middle of the teardrop.
  html: `<span class="picked-pin-pulse" aria-hidden="true"></span>
  <svg width="36" height="46" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 34.5S25.5 20.5 25.5 13a11.5 11.5 0 1 0-23 0C2.5 20.5 14 34.5 14 34.5Z"
          fill="${PICK_COLOR}" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round"/>
    <circle cx="14" cy="13" r="4.2" fill="#ffffff"/>
  </svg>`,
  iconSize: [36, 46],
  iconAnchor: [18, 46],
});

/**
 * A Google map when a Maps JavaScript API key is configured, otherwise an
 * OpenStreetMap map. Google data may only be shown on a Google map, so the
 * choice also decides whether the API is asked for Google counts.
 *
 * The legend, scale bar and north mark are plain DOM overlays rather than
 * map-library controls, so they render the same way over either provider.
 */
export function MapPicker(props: MapPickerProps) {
  // React Query keys by point, and SegmentsView asks for the same data, so this
  // shares that cache entry rather than making a second request.
  const pois = usePois(props.point);
  const facilities = pois.data?.facilities ?? [];

  return (
    <>
      {USE_GOOGLE_MAP ? (
        <GoogleMapPicker {...props} />
      ) : (
        <OpenStreetMapPicker {...props} facilities={facilities} />
      )}
      {/* A rail rather than a bare legend: the scale bar lands under it, and the
          legend itself grows and shrinks with the facilities found. */}
      <div className="map-rail">
        <MapLegend facilityCount={facilities.length} />
      </div>
    </>
  );
}

function OpenStreetMapPicker({
  initialCenter,
  point,
  onPick,
  onCenterChange,
  facilities,
}: MapPickerProps & { facilities: readonly PoiFacility[] }) {
  return (
    <MapContainer className="map" center={[initialCenter.lat, initialCenter.lng]} zoom={14} scrollWheelZoom>
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} />
      <MapEvents onPick={onPick} onCenterChange={onCenterChange} />
      {/* Distance is the whole basis of the zones, so a scale bar earns its
          place here more than on most maps. Metric only. A wider maxWidth,
          larger than Leaflet's default of 100px, makes the bar itself longer,
          so it doesn't read as a stray sliver next to the wider attribution
          line beneath it. */}
      <ScaleControl position="bottomleft" imperial={false} maxWidth={160} />
      {point !== null && (
        <>
          {ZONE_RINGS.map((ring) => (
            <Circle
              key={ring.zone}
              center={[point.lat, point.lng]}
              radius={ring.to}
              pathOptions={{ color: ring.color, weight: 2, fillOpacity: 0.04, interactive: false }}
            />
          ))}
          <FacilityMarkers facilities={facilities} />
          <Marker position={[point.lat, point.lng]} icon={PICKED_PIN} interactive={false} />
        </>
      )}
    </MapContainer>
  );
}

/**
 * The facilities the score was actually built from. Closed records (Data
 * Quality 0) are left out, because the engine gives them no weight either.
 * Leaflet only — the Google map path has no marker layer of its own yet.
 */
function FacilityMarkers({ facilities }: { facilities: readonly PoiFacility[] }) {
  return (
    <>
      {facilities
        .filter((facility) => facility.dataQuality > 0)
        .map((facility) => (
          <CircleMarker
            key={facility.id}
            center={[facility.lat, facility.lng]}
            radius={4}
            pathOptions={{
              color: '#ffffff',
              weight: 1,
              fillColor: facilityColor(facility.kind),
              fillOpacity: 0.85,
            }}
          >
            <Tooltip direction="top" offset={[0, -4]}>
              <strong>{facility.name ?? FACILITY_KIND_LABELS[facility.kind]}</strong>
              <br />
              {FACILITY_KIND_LABELS[facility.kind]} · {formatDistance(facility.distanceMeters)}
            </Tooltip>
          </CircleMarker>
        ))}
    </>
  );
}

function MapLegend({ facilityCount }: { facilityCount: number }) {
  return (
    <div className="zone-legend" aria-label="Keterangan peta">
      {/* Each swatch is inked to its own distance weight, so the legend shows
          that nearer counts for more instead of explaining it in a sentence. */}
      {[...ZONE_RINGS].reverse().map((ring) => (
        <span key={ring.zone} className="zone-legend-item">
          <span
            className="zone-swatch"
            style={{
              borderColor: ring.color,
              // Only the fill thins out. A faded outline too would leave the
              // outermost swatch almost invisible against the panel.
              background: `color-mix(in srgb, ${ring.color} ${
                ZONE_WEIGHTS[ring.zone.toLowerCase() as 'a' | 'b' | 'c'] * 100
              }%, transparent)`,
            }}
            aria-hidden="true"
          />
          {ring.from.toLocaleString('id-ID')}–{ring.to.toLocaleString('id-ID')} m
        </span>
      ))}

      {facilityCount > 0 && (
        /* Hidden on a phone, where the sheet leaves too little map for it. */
        <div className="legend-section legend-facilities">
          {FACILITY_GROUPS.map((group) => (
            <span key={group.id} className="zone-legend-item">
              <span className="facility-dot" style={{ background: group.color }} aria-hidden="true" />
              {group.label}
            </span>
          ))}
          {/* An absence cannot be drawn, so this one fact needs saying. */}
          <span className="legend-footnote">Usaha yang sudah tutup tidak digambar</span>
        </div>
      )}
    </div>
  );
}

function MapEvents({ onPick, onCenterChange }: Pick<MapPickerProps, 'onPick' | 'onCenterChange'>) {
  const map = useMapEvents({
    click: (event) => onPick({ lat: event.latlng.lat, lng: event.latlng.lng }),
    moveend: () => {
      const center = map.getCenter();
      onCenterChange({ lat: center.lat, lng: center.lng });
    },
  });
  return null;
}
