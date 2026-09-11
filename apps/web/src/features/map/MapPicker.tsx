import { ZONE_LIMITS_METERS, type LatLng } from '@gayatama/scoring';
import { Circle, CircleMarker, MapContainer, TileLayer, useMapEvents } from 'react-leaflet';

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Distance zones, drawn largest first so the smaller rings sit on top. */
export const ZONE_RINGS = [
  { zone: 'C', from: ZONE_LIMITS_METERS.b, to: ZONE_LIMITS_METERS.c, color: '#64748b' },
  { zone: 'B', from: ZONE_LIMITS_METERS.a, to: ZONE_LIMITS_METERS.b, color: '#0d9488' },
  { zone: 'A', from: 0, to: ZONE_LIMITS_METERS.a, color: '#0f766e' },
] as const;

interface MapPickerProps {
  initialCenter: LatLng;
  point: LatLng | null;
  onPick: (point: LatLng) => void;
  onCenterChange: (center: LatLng) => void;
}

export function MapPicker({ initialCenter, point, onPick, onCenterChange }: MapPickerProps) {
  return (
    <>
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
              pathOptions={{ color: '#ffffff', weight: 2, fillColor: '#b91c1c', fillOpacity: 1, interactive: false }}
            />
          </>
        )}
      </MapContainer>
      <ZoneLegend />
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
