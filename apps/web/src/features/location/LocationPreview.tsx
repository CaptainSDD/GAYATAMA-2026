import type { BusinessType, LatLng } from '@gayatama/scoring';
import { GaugeIcon } from '../../components/Icons';
import { formatCoordinate } from '../../lib/format';
import { useLocationDetails } from '../../lib/queries';

interface LocationPreviewProps {
  point: LatLng;
  businessType: BusinessType;
  onAnalyse: () => void;
  /** Starts the location-first route, for visitors who have not chosen a category. */
  onCompare: () => void;
}

/**
 * One flat stack, read top to bottom: which place, what is known about it, then
 * the action.
 *
 * It used to nest five levels deep — panel, body, section, heading row, inner
 * div — to show four facts, and hid the address facts behind a disclosure while
 * the heading above it said only "Titik di Kota Semarang". The facts a visitor
 * needs to confirm they picked the right spot are the ones that were folded
 * away, so they are printed instead. Spacing does the grouping that the wrapper
 * divs were doing.
 */
export function LocationPreview({ point, onAnalyse, onCompare }: LocationPreviewProps) {
  const details = useLocationDetails(point);
  const address = details.data?.address ?? null;
  const heading = address?.village ?? address?.district ?? address?.city ?? 'Titik di Kota Semarang';

  return (
    <section className="location-preview" aria-labelledby="selected-location-title">
      <h2 id="selected-location-title">{details.isPending ? 'Menyiapkan lokasi…' : heading}</h2>

      {details.isPending ? (
        <p className="location-lookup-status" role="status">
          <span className="spinner" aria-hidden="true" /> Mencari alamat terdekat…
        </p>
      ) : address === null ? (
        <p className="location-note">Alamat belum tersedia. Pastikan posisi titik sudah tepat di peta.</p>
      ) : (
        address.formatted !== null && <p className="location-address">{address.formatted}</p>
      )}

      {address !== null && (
        <dl className="location-facts">
          <LocationFact label="Kelurahan" value={address.village} />
          <LocationFact label="Kecamatan" value={address.district} />
          <LocationFact label="Kota" value={address.city} />
          <LocationFact label="Kode pos" value={address.postcode} />
        </dl>
      )}

      <span className="location-coordinate">Koordinat {formatCoordinate(point)}</span>

      {details.data?.source !== null && details.data?.source !== undefined && (
        <small className="location-source">Alamat: {details.data.source.attribution}</small>
      )}

      <hr className="location-rule" />

      <div className="analysis-confirmation">
        <button type="button" className="button-primary" onClick={onAnalyse}>
          <GaugeIcon size={18} /> Analisis lokasi
        </button>
        <button type="button" className="button-link" onClick={onCompare}>
          Belum tahu mau usaha apa? Bandingkan semuanya
        </button>
      </div>
    </section>
  );
}

function LocationFact({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value ?? 'Belum tersedia'}</dd>
    </div>
  );
}
