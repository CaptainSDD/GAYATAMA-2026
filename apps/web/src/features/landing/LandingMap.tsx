import { ZONE_LIMITS_METERS, type Zone } from '@gayatama/scoring';
import { Circle, MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { LANDING_EXAMPLE } from './landingExample';

/**
 * The hero's real map.
 *
 * A studio's landing page runs a photograph of the thing it made, because a
 * photograph is its evidence. The equivalent here is not a stock photo of a
 * shopfront — PRODUCT.md forbids inventing evidence, and a bought photograph of
 * somebody else's warung standing beside a score is exactly that. The image
 * this product owns is a map.
 *
 * So: real OpenStreetMap tiles, the documented Semarang example point, and the
 * three analysis rings at their true radii in metres. Leaflet places a `Circle`
 * by ground distance, so 300 m is 300 m at this latitude and zoom rather than a
 * drawn approximation.
 *
 * Inert on purpose. This is a backdrop, not the product: every interaction
 * handler is off, it is hidden from assistive technology, and the headline over
 * it is what the visitor is meant to read. The map behind a marketing headline
 * that fights back for the pointer would be worse than no map.
 *
 * Loaded lazily by the hero. Leaflet is 60 kB gzip and this audience is often on
 * mobile data, so it must not sit in the critical path of a page whose first job
 * is a sentence.
 */

const RING_ORDER: Zone[] = ['c', 'b', 'a'];

/**
 * Zoom 15.
 *
 * At 13 the 1,500 m ring came out ~80 px across in a 1,440 px band: the rings
 * were a smudge in the middle of a city map, so the image read as generic
 * basemap wallpaper rather than as the thing this product draws. The band is
 * now the whole first viewport rather than a strip, so it needs a subject at
 * that scale: at 15 the outer ring is ~630 px across and the three zones are
 * the picture, which is the only reason the map is here.
 */
const ZOOM = 15;

export default function LandingMap() {
  const { point } = LANDING_EXAMPLE;

  return (
    <div className="landing-map" aria-hidden="true">
      <MapContainer
        className="landing-map-canvas"
        center={[point.lat, point.lng]}
        zoom={ZOOM}
        zoomControl={false}
        /* Leaflet's own credit is off, and the page renders the ODbL credit
           itself just below the band — see `.landing-credit`. Two reasons.
           The band is masked so its lower half dissolves into the page, and a
           credit inside it would dissolve with the tiles it is required to
           credit. And Leaflet's default control ships a "Leaflet |" prefix with
           a Unicode flag glyph in it, which is another product's branding and an
           emoji standing in for an icon — neither belongs on this page. */
        attributionControl={false}
        dragging={false}
        scrollWheelZoom={false}
        doubleClickZoom={false}
        touchZoom={false}
        boxZoom={false}
        keyboard={false}
      >
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {RING_ORDER.map((zone) => (
          <Circle
            key={zone}
            center={[point.lat, point.lng]}
            radius={ZONE_LIMITS_METERS[zone]}
            pathOptions={{
              // Leaflet paints through canvas and cannot resolve `var()`, so the
              // teal is a literal here — the same constraint the app's facility
              // colours carry, and documented alongside them. It is also why the
              // night register lifts the overlay pane with a CSS filter instead
              // of recolouring these: the tile pane is inverted and this pane is
              // not, which left the rings at teal on near-black.
              color: '#0f766e',
              weight: 2,
              fillColor: '#0f766e',
              fillOpacity: zone === 'a' ? 0.2 : zone === 'b' ? 0.12 : 0.06,
              interactive: false,
            }}
          />
        ))}
      </MapContainer>
    </div>
  );
}
