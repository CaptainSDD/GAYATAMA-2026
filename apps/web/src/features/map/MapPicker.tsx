import { Circle, CircleMarker, MapContainer, TileLayer, useMapEvents } from 'react-leaflet';
import { USE_GOOGLE_MAP } from '../../lib/map-config';
import { GoogleMapPicker } from './GoogleMapPicker';
import { PICK_COLOR, ZONE_RINGS, type MapPickerProps } from './zones';

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/**
 * A Google map when a Maps JavaScript API key is configured, otherwise an
 * OpenStreetMap map. Google data may only be shown on a Google map, so the
 * choice also decides whether the API is asked for Google counts.
 */
export function MapPicker(props: MapPickerProps) {
  return (
    <>
      {USE_GOOGLE_MAP ? <GoogleMapPicker {...props} /> : <OpenStreetMapPicker {...props} />}
      <ZoneLegend />
    </>
  );
}

function OpenStreetMapPicker({ initialCenter, point, onPick, onCenterChange }: MapPickerProps) {
  return (
    <MapContainer className="map" center={[initialCenter.lat, initialCenter.lng]} zoom={14} scrollWheelZoom>
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} />
      <MapEvents onPick={onPick} onCenterChange={onCenterChange} />
      {point !== null && (
        <>
          {ZONE_RINGS.map((ring) => (
            <Circle
              key={ring.zone}
              center={[point.lat, point.lng]}
              radius={ring.to}
              pathOptions={{ color: ring.color, weight: 1.5, fillOpacity: 0.05, interactive: false }}
            />
          ))}
          <CircleMarker
            center={[point.lat, point.lng]}
            radius={7}
            pathOptions={{ color: '#ffffff', weight: 2, fillColor: PICK_COLOR, fillOpacity: 1, interactive: false }}
          />
        </>
      )}
    </MapContainer>
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

function ZoneLegend() {
  return (
    <div className="zone-legend" aria-label="Distance zones">
      {[...ZONE_RINGS].reverse().map((ring) => (
        <span key={ring.zone} className="zone-legend-item">
          <span className="zone-swatch" style={{ borderColor: ring.color }} aria-hidden="true" />
          Zone {ring.zone} · {ring.from.toLocaleString('en-US')}–{ring.to.toLocaleString('en-US')} m
        </span>
      ))}
    </div>
  );
}
