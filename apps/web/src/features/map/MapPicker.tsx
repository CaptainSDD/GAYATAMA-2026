import { type FacilityKind, type LatLng } from '@gayatama/scoring';
import { divIcon } from 'leaflet';
// Ships with the map chunk rather than the entry bundle: a visitor on the
// landing page should not download Leaflet's stylesheet to read a pitch.
import 'leaflet/dist/leaflet.css';
import { useCallback, useMemo, useState } from 'react';
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  ScaleControl,
  TileLayer,
  Tooltip,
  useMapEvents,
} from 'react-leaflet';
import type { PoiFacility } from '../../lib/api-types';
import { FACILITY_KIND_LABELS } from '../../lib/copy';
import { formatDistance } from '../../lib/format';
import { SEMARANG_MAP_LIMITS } from '../../lib/location';
import { USE_GOOGLE_MAP } from '../../lib/map-config';
import { usePois } from '../../lib/queries';
import { SEMARANG_BOUNDARY } from '../../lib/semarang-boundary';
import { GoogleMapPicker } from './GoogleMapPicker';
import { useKeyboardPan } from './useKeyboardPan';
import { ZoneLabel } from './ZoneLabel';
import {
  DEFAULT_MAP_ZOOM,
  PICK_COLOR,
  ZONE_RINGS,
  zoneBandRings,
  zoneFillOpacity,
  zoneLabelPoint,
  type MapPickerProps,
  type ZoneHover,
  type ZoneHoverProps,
} from './zones';

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/**
 * Facility groups, coloured so the evidence behind a score is legible at a
 * glance: what creates demand, what competes, and what supports a transaction.
 * The colours are read off the dot tooltips now that the legend is gone — each
 * marker names its own kind, so nothing depends on a colour key.
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
function pickedPin(label?: 'A' | 'B') {
  // Comparing two sites needs them told apart. A letter does that without
  // introducing a second colour: the pin itself stays exactly as it was.
  const face =
    label === undefined
      ? '<circle cx="14" cy="13" r="4.2" fill="#ffffff"/>'
      : `<circle cx="14" cy="13" r="6.6" fill="#ffffff"/>
         <text x="14" y="13.4" text-anchor="middle" dominant-baseline="central"
               font-size="9" font-weight="700" fill="${PICK_COLOR}">${label}</text>`;
  return divIcon({
    className: 'picked-pin',
    // The pulse sits behind the pin at the anchor point, so it rings the exact
    // coordinate rather than the middle of the teardrop.
    html: `<span class="picked-pin-pulse" aria-hidden="true"></span>
  <svg width="36" height="46" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 34.5S25.5 20.5 25.5 13a11.5 11.5 0 1 0-23 0C2.5 20.5 14 34.5 14 34.5Z"
          fill="${PICK_COLOR}" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round"/>
    ${face}
  </svg>`,
    iconSize: [36, 46],
    iconAnchor: [18, 46],
  });
}

const PICKED_PIN = pickedPin();
const PIN_A = pickedPin('A');
const PIN_B = pickedPin('B');

/** Nothing to see: it exists only to hang a zone's label at a point on the map. */
const LABEL_ANCHOR = divIcon({ className: 'zone-label-anchor', iconSize: [0, 0] });

/**
 * A Google map when a Maps JavaScript API key is configured, otherwise an
 * OpenStreetMap map. Google data may only be shown on a Google map, so the
 * choice also decides whether the API is asked for Google counts.
 *
 * The coverage label is a plain DOM overlay rather than a map-library control,
 * so it renders the same way over either provider.
 */
export function MapPicker(props: MapPickerProps) {
  // React Query keys by point, and SegmentsView asks for the same data, so this
  // shares that cache entry rather than making a second request.
  const pois = usePois(props.analysisPoint);
  const facilities = pois.data?.facilities ?? [];
  // Which band the pointer is inside. Held here so both providers take it as the
  // same prop and label their zones through the same shared component.
  const [hoveredZone, setHoveredZone] = useState<ZoneHover>(null);

  return (
    <>
      {USE_GOOGLE_MAP ? (
        <GoogleMapPicker {...props} hoveredZone={hoveredZone} onZoneHover={setHoveredZone} />
      ) : (
        <OpenStreetMapPicker
          {...props}
          facilities={facilities}
          hoveredZone={hoveredZone}
          onZoneHover={setHoveredZone}
        />
      )}
      <div className="coverage-label" aria-hidden="true">
        <span /> Area cakupan Semarang
      </div>
    </>
  );
}

function OpenStreetMapPicker({
  initialCenter,
  point,
  analysisPoint,
  comparing = false,
  secondPoint = null,
  onPick,
  onCenterChange,
  facilities,
  hoveredZone,
  onZoneHover,
}: MapPickerProps & ZoneHoverProps & { facilities: readonly PoiFacility[] }) {
  return (
    <MapContainer
      className="map"
      center={[initialCenter.lat, initialCenter.lng]}
      zoom={DEFAULT_MAP_ZOOM}
      zoomSnap={0.1}
      minZoom={10}
      maxBounds={[
        [SEMARANG_MAP_LIMITS.south, SEMARANG_MAP_LIMITS.west],
        [SEMARANG_MAP_LIMITS.north, SEMARANG_MAP_LIMITS.east],
      ]}
      maxBoundsViscosity={1}
      scrollWheelZoom
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} />
      <CoverageOverlay />
      <MapEvents onPick={onPick} onCenterChange={onCenterChange} />
      {/* Distance is the whole basis of the zones, so a scale bar earns its
          place here more than on most maps. Metric only. A wider maxWidth,
          larger than Leaflet's default of 100px, makes the bar itself longer,
          so it doesn't read as a stray sliver next to the wider attribution
          line beneath it. */}
      <ScaleControl position="bottomleft" imperial={false} maxWidth={160} />
      {point !== null && (
        <>
          {analysisPoint !== null && (
            <>
              <ZoneBands center={analysisPoint} hoveredZone={hoveredZone} onZoneHover={onZoneHover} />
              {/* Outline only — the bands underneath carry the fill, so a disc
                  here would tint the inner zones a second time. */}
              {ZONE_RINGS.map((ring) => (
                <Circle
                  key={ring.zone}
                  center={[analysisPoint.lat, analysisPoint.lng]}
                  radius={ring.to}
                  pathOptions={{ color: ring.color, weight: 2, fill: false, interactive: false }}
                />
              ))}
              <FacilityMarkers facilities={facilities} />
            </>
          )}
          <Marker position={[point.lat, point.lng]} icon={comparing ? PIN_A : PICKED_PIN} interactive={false} />
        </>
      )}
      {comparing && secondPoint !== null && (
        <Marker position={[secondPoint.lat, secondPoint.lng]} icon={PIN_B} interactive={false} />
      )}
    </MapContainer>
  );
}

/**
 * The distance zones as shapes that answer back. Each band is filled in its own
 * colour at the weight the engine gives it, and deepens while the pointer is
 * inside it, so the ranges the legend used to list are read off the map itself.
 */
function ZoneBands({ center, hoveredZone, onZoneHover }: { center: LatLng } & ZoneHoverProps) {
  // 128 points a ring is cheap, but not worth redoing on every hover — only when
  // the analysed point moves.
  const bands = useMemo(() => ZONE_RINGS.map((ring) => ({ ring, paths: zoneBandRings(center, ring) })), [center]);
  const hovered = ZONE_RINGS.find((ring) => ring.zone === hoveredZone);

  return (
    <>
      {bands.map(({ ring, paths }) => (
        <Polygon
          key={ring.zone}
          positions={paths}
          // Deliberately no click handler: Leaflet hands a click to the map only
          // when nothing under the pointer listens for one, and clicking inside
          // the rings has to keep picking a point.
          eventHandlers={{ mouseover: () => onZoneHover(ring.zone), mouseout: () => onZoneHover(null) }}
          pathOptions={{
            stroke: false,
            fillColor: ring.color,
            fillOpacity: zoneFillOpacity(ring, hoveredZone === ring.zone),
          }}
        />
      ))}
      {hovered !== undefined && (
        // A marker with no icon of its own, carrying a centred tooltip: Leaflet
        // then does the projecting and keeps the label glued to the band as the
        // map moves. Tooltips ignore the pointer, so the hover underneath holds.
        <Marker position={zoneLabelPoint(center, hovered)} icon={LABEL_ANCHOR} interactive={false}>
          <Tooltip permanent direction="center" className="zone-label-tooltip" opacity={1}>
            <ZoneLabel ring={hovered} />
          </Tooltip>
        </Marker>
      )}
    </>
  );
}

const LEAFLET_BOUNDARY = SEMARANG_BOUNDARY.map(({ lat, lng }) => [lat, lng] as [number, number]);
const LEAFLET_MASK_RINGS: [number, number][][] = [
  [
    [SEMARANG_MAP_LIMITS.south, SEMARANG_MAP_LIMITS.west],
    [SEMARANG_MAP_LIMITS.south, SEMARANG_MAP_LIMITS.east],
    [SEMARANG_MAP_LIMITS.north, SEMARANG_MAP_LIMITS.east],
    [SEMARANG_MAP_LIMITS.north, SEMARANG_MAP_LIMITS.west],
  ],
  LEAFLET_BOUNDARY,
];

function CoverageOverlay() {
  return (
    <>
      <Polygon
        positions={LEAFLET_MASK_RINGS}
        pathOptions={{
          stroke: false,
          fillColor: '#475569',
          fillOpacity: 0.38,
          fillRule: 'evenodd',
          interactive: false,
        }}
      />
      <Polyline
        positions={LEAFLET_BOUNDARY}
        pathOptions={{ color: '#dc2626', opacity: 0.95, weight: 3, dashArray: '5 7', interactive: false }}
      />
    </>
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

function MapEvents({ onPick, onCenterChange }: Pick<MapPickerProps, 'onPick' | 'onCenterChange'>) {
  const map = useMapEvents({
    click: (event) => onPick({ lat: event.latlng.lat, lng: event.latlng.lng }),
    moveend: () => {
      const center = map.getCenter();
      onCenterChange({ lat: center.lat, lng: center.lng });
    },
  });

  const panBy = useCallback((dx: number, dy: number) => map.panBy([dx, dy]), [map]);
  useKeyboardPan(map.getContainer(), panBy);

  return null;
}
