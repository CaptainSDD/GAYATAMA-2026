import { AdvancedMarker, APIProvider, Circle, ControlPosition, Map } from '@vis.gl/react-google-maps';
import type { CSSProperties } from 'react';
import { GOOGLE_MAP_ID, GOOGLE_MAPS_API_KEY } from '../../lib/map-config';
import { PICK_COLOR, ZONE_RINGS, type MapPickerProps } from './zones';

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
export function GoogleMapPicker({ initialCenter, point, onPick, onCenterChange }: MapPickerProps) {
  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
      <Map
        className="map"
        mapId={GOOGLE_MAP_ID}
        defaultCenter={initialCenter}
        defaultZoom={14}
        gestureHandling="greedy"
        // A click on a shop or landmark picks that spot instead of opening Google's place card.
        clickableIcons={false}
        // Google's defaults put zoom and fullscreen in the two right-hand
        // corners, which is exactly where the results panel now lives. Both move
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
        {point !== null && (
          <>
            {ZONE_RINGS.map((ring) => (
              <Circle
                key={ring.zone}
                center={point}
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
