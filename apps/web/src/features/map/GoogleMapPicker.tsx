import { AdvancedMarker, APIProvider, Circle, ControlPosition, Map, Polygon, Polyline } from '@vis.gl/react-google-maps';
import type { CSSProperties } from 'react';
import { SEMARANG_MAP_LIMITS } from '../../lib/location';
import { GOOGLE_MAP_ID, GOOGLE_MAPS_API_KEY } from '../../lib/map-config';
import { SEMARANG_BOUNDARY } from '../../lib/semarang-boundary';
import { DEFAULT_MAP_ZOOM, PICK_COLOR, ZONE_RINGS, type MapPickerProps } from './zones';

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

/** The Google map, drawn when a Maps JavaScript API key is configured. */
export function GoogleMapPicker({ initialCenter, point, analysisPoint, onPick, onCenterChange }: MapPickerProps) {
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
            {analysisPoint !== null &&
              ZONE_RINGS.map((ring) => (
                <Circle
                  key={ring.zone}
                  center={analysisPoint}
                  radius={ring.to}
                  strokeColor={ring.color}
                  strokeWeight={1.5}
                  fillColor={ring.color}
                  fillOpacity={0.05}
                  clickable={false}
                />
              ))}
            <AdvancedMarker position={point} clickable={false} anchorLeft="-50%" anchorTop="-50%" title="Lokasi terpilih">
              <span className="picked-dot">
                <span className="picked-pin-pulse" aria-hidden="true" />
                <span style={PICK_MARKER_STYLE} />
              </span>
            </AdvancedMarker>
          </>
        )}
      </Map>
    </APIProvider>
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
