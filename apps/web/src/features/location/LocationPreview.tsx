import type { BusinessType, LatLng } from '@gayatama/scoring';
import { GaugeIcon, MapPinIcon } from '../../components/Icons';
import { BUSINESS_TYPE_LABELS } from '../../lib/copy';
import { formatCoordinate } from '../../lib/format';
import { useLocationDetails } from '../../lib/queries';

interface LocationPreviewProps {
  point: LatLng;
  businessType: BusinessType;
  onAnalyse: () => void;
}

export function LocationPreview({ point, businessType, onAnalyse }: LocationPreviewProps) {
  const details = useLocationDetails(point);
  const address = details.data?.address ?? null;
  const heading = address?.village ?? address?.district ?? address?.city ?? 'Titik di Kota Semarang';

  return (
    <section className="location-preview" aria-labelledby="selected-location-title">
      <div className="location-preview-heading">
        <span className="location-preview-icon" aria-hidden="true">
          <MapPinIcon size={20} />
        </span>
        <div>
          <span className="eyebrow">Lokasi pilihan</span>
          <h2 id="selected-location-title">{details.isPending ? 'Menyiapkan lokasi…' : heading}</h2>
        </div>
      </div>

      {details.isPending ? (
        <p className="location-lookup-status" role="status">
          <span className="spinner" aria-hidden="true" /> Mencari alamat terdekat…
        </p>
      ) : address === null ? (
        <p className="notice notice-neutral">Alamat belum tersedia. Pastikan posisi titik sudah tepat di peta.</p>
      ) : (
        address.formatted !== null && <p className="location-address">{address.formatted}</p>
      )}

      <details className="panel-disclosure location-details">
        <summary>Detail lokasi</summary>
        <div className="disclosure-content">
          {address !== null && (
            <dl className="location-facts">
              <LocationFact label="Kelurahan" value={address.village} />
              <LocationFact label="Kecamatan" value={address.district} />
              <LocationFact label="Kota" value={address.city} />
              <LocationFact label="Kode pos" value={address.postcode} />
            </dl>
          )}
          <span className="location-coordinate">Koordinat {formatCoordinate(point)}</span>
        </div>
      </details>
      {details.data?.source !== null && details.data?.source !== undefined && (
        <small className="location-source">Alamat: {details.data.source.attribution}</small>
      )}

      <div className="analysis-confirmation">
        <p className="analysis-target">
          Siap dianalisis untuk <strong>{BUSINESS_TYPE_LABELS[businessType]}</strong>
        </p>
        <button type="button" className="button-primary" onClick={onAnalyse}>
          <GaugeIcon size={18} /> Analisis lokasi
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
