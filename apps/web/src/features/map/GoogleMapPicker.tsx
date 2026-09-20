import type { LatLng } from '@gayatama/scoring';
import { AdvancedMarker, APIProvider, Circle, ControlPosition, Map, Polygon, Polyline, useMap } from '@vis.gl/react-google-maps';
import { useCallback, useMemo, type CSSProperties } from 'react';
import { SEMARANG_MAP_LIMITS } from '../../lib/location';
import { GOOGLE_MAP_ID, GOOGLE_MAPS_API_KEY } from '../../lib/map-config';
import { SEMARANG_BOUNDARY } from '../../lib/semarang-boundary';
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
  type ZoneHoverProps,
} from './zones';

// Sized to read at the same distance as the Leaflet teardrop, which is much
// larger than a plain dot; the shared .picked-pin-pulse ring is layered behind.
const PICK_MARKER_STYLE: CSSProperties = {
  display: 'block',
  width: 22,
  height: 22,
  borderRadius: '50%',
  border: '4px solid #ffffff',
  background: PICK_COLOR,
  boxShadow: '0 1px 4px rgba(15, 23, 42, 0.45)',
};

// Only used while comparing two sites: the letter needs room and centring that
// the plain dot does not. Same colours, one size larger.
const PICK_MARKER_LABEL_STYLE: CSSProperties = {
  ...PICK_MARKER_STYLE,
  display: 'grid',
  placeItems: 'center',
  width: 26,
  height: 26,
  color: '#ffffff',
  fontSize: 'var(--text-2xs)',
  fontWeight: 700,
  lineHeight: 1,
};

/** The Google map, drawn when a Maps JavaScript API key is configured. */
export function GoogleMapPicker({
  initialCenter,
  point,
  analysisPoint,
  comparing = false,
  secondPoint = null,
  onPick,
  onCenterChange,
  hoveredZone,
  onZoneHover,
}: MapPickerProps & ZoneHoverProps) {
  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
      <Map
        className="map"
        mapId={GOOGLE_MAP_ID}
        defaultCenter={initialCenter}
        defaultZoom={DEFAULT_MAP_ZOOM}
        restriction={{ latLngBounds: SEMARANG_MAP_LIMITS, strictBounds: false }}
        minZoom={10}
        gestureHandling="greedy"
        // A click on a shop or landmark picks that spot instead of opening Google's place card.
        clickableIcons={false}
        // Google's defaults put zoom and fullscreen in the two right-hand
        // corners, which is exactly where the results card now floats. Both move
        // to the foot of the left edge; street view, the map-type picker and the
        // tilt/rotate control go entirely, since nothing here uses them.
        zoomControl
        zoomControlOptions={{ position: ControlPosition.LEFT_BOTTOM }}
        fullscreenControl
        fullscreenControlOptions={{ position: ControlPosition.LEFT_BOTTOM }}
        streetViewControl={false}
        mapTypeControl={false}
        cameraControl={false}
        // Distance is the whole basis of the zones, so the scale earns its place.
        scaleControl
        onClick={(event) => {
          const { latLng } = event.detail;
          if (latLng !== null) onPick({ lat: latLng.lat, lng: latLng.lng });
        }}
        onIdle={(event) => {
          const center = event.map.getCenter();
          if (center !== undefined) onCenterChange({ lat: center.lat(), lng: center.lng() });
        }}
      >
        <CoverageOverlay />
        {point !== null && (
          <>
            {analysisPoint !== null && (
              <>
                <ZoneBands
                  center={analysisPoint}
                  hoveredZone={hoveredZone}
                  onZoneHover={onZoneHover}
                  onPick={onPick}
                />
                {/* Outline only — the bands underneath carry the fill, so a disc
                    here would tint the inner zones a second time. */}
                {ZONE_RINGS.map((ring) => (
                  <Circle
                    key={ring.zone}
                    center={analysisPoint}
                    radius={ring.to}
                    strokeColor={ring.color}
                    strokeWeight={1.5}
                    fillOpacity={0}
                    clickable={false}
                  />
                ))}
              </>
            )}
            <AdvancedMarker
              position={point}
              clickable={false}
              anchorLeft="-50%"
              anchorTop="-50%"
              title={comparing ? 'Lokasi A' : 'Lokasi terpilih'}
            >
              <span className="picked-dot">
                <span className="picked-pin-pulse" aria-hidden="true" />
                {comparing ? <span style={PICK_MARKER_LABEL_STYLE}>A</span> : <span style={PICK_MARKER_STYLE} />}
              </span>
            </AdvancedMarker>
          </>
        )}
        {comparing && secondPoint !== null && (
          <AdvancedMarker position={secondPoint} clickable={false} anchorLeft="-50%" anchorTop="-50%" title="Lokasi B">
            <span className="picked-dot">
              <span className="picked-pin-pulse" aria-hidden="true" />
              <span style={PICK_MARKER_LABEL_STYLE}>B</span>
            </span>
          </AdvancedMarker>
        )}
        <KeyboardPan />
      </Map>
    </APIProvider>
  );
}

/**
 * Lives inside <Map> so `useMap` can reach the instance the provider created.
 * Renders nothing; it only teaches the map to answer arrow keys.
 */
function KeyboardPan() {
  const map = useMap();
  const panBy = useCallback((dx: number, dy: number) => map?.panBy(dx, dy), [map]);
  useKeyboardPan(map?.getDiv(), panBy);
  return null;
}

/**
 * The distance zones as shapes that answer back. Each band is filled in its own
 * colour at the weight the engine gives it, and deepens while the pointer is
 * inside it, so the ranges the legend used to list are read off the map itself.
 */
function ZoneBands({
  center,
  hoveredZone,
  onZoneHover,
  onPick,
}: { center: LatLng } & ZoneHoverProps & Pick<MapPickerProps, 'onPick'>) {
  // 128 points a ring is cheap, but not worth redoing on every hover — only when
  // the analysed point moves.
  const bands = useMemo(() => ZONE_RINGS.map((ring) => ({ ring, paths: zoneBandRings(center, ring) })), [center]);
  const hovered = ZONE_RINGS.find((ring) => ring.zone === hoveredZone);

  return (
    <>
      {bands.map(({ ring, paths }) => (
        <Polygon
          key={ring.zone}
          paths={paths}
          strokeOpacity={0}
          fillColor={ring.color}
          fillOpacity={zoneFillOpacity(ring, hoveredZone === ring.zone)}
          // Hover needs the shape clickable, and a clickable shape swallows the
          // map's own click — so the pick is forwarded on from here, otherwise
          // clicking inside the rings would stop choosing a point.
          clickable
          onMouseOver={() => onZoneHover(ring.zone)}
          onMouseOut={() => onZoneHover(null)}
          onClick={(event) => {
            const { latLng } = event;
            if (latLng !== null) onPick({ lat: latLng.lat(), lng: latLng.lng() });
          }}
        />
      ))}
      {hovered !== undefined && (
        // Centred on the label point, the same way the pins are, so the label
        // sits in the middle of its band rather than hanging above it.
        <AdvancedMarker
          position={zoneLabelPoint(center, hovered)}
          className="zone-label-marker"
          clickable={false}
          anchorLeft="-50%"
          anchorTop="-50%"
        >
          <ZoneLabel ring={hovered} />
        </AdvancedMarker>
      )}
    </>
  );
}

const GOOGLE_MASK_OUTER_RING = [
  { lat: SEMARANG_MAP_LIMITS.south, lng: SEMARANG_MAP_LIMITS.west },
  { lat: SEMARANG_MAP_LIMITS.south, lng: SEMARANG_MAP_LIMITS.east },
  { lat: SEMARANG_MAP_LIMITS.north, lng: SEMARANG_MAP_LIMITS.east },
  { lat: SEMARANG_MAP_LIMITS.north, lng: SEMARANG_MAP_LIMITS.west },
] as const;

const GOOGLE_DASHED_LINE = [
  {
    icon: {
      path: 'M 0,-1 0,1',
      strokeColor: '#dc2626',
      strokeOpacity: 0.95,
      strokeWeight: 3,
      scale: 2,
    },
    offset: '0',
    repeat: '10px',
  },
];

function CoverageOverlay() {
  return (
    <>
      <Polygon
        paths={[GOOGLE_MASK_OUTER_RING, [...SEMARANG_BOUNDARY].reverse()]}
        fillColor="#475569"
        fillOpacity={0.38}
        strokeOpacity={0}
        clickable={false}
      />
      <Polyline path={SEMARANG_BOUNDARY} strokeOpacity={0} icons={GOOGLE_DASHED_LINE} clickable={false} />
    </>
  );
}
