import { AdvancedMarker, APIProvider, Circle, Map } from '@vis.gl/react-google-maps';
import type { CSSProperties } from 'react';
import { GOOGLE_MAP_ID, GOOGLE_MAPS_API_KEY } from '../../lib/map-config';
import { PICK_COLOR, ZONE_RINGS, type MapPickerProps } from './zones';

const PICK_MARKER_STYLE: CSSProperties = {
  display: 'block',
  width: 14,
  height: 14,
  borderRadius: '50%',
  border: '2px solid #ffffff',
  background: PICK_COLOR,
  boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.3)',
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
            <AdvancedMarker position={point} clickable={false} anchorLeft="-50%" anchorTop="-50%" title="Chosen location">
              <span style={PICK_MARKER_STYLE} />
            </AdvancedMarker>
          </>
        )}
      </Map>
    </APIProvider>
  );
}
