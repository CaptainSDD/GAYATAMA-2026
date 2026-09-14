import { BUSINESS_TYPES, type BusinessType, type LatLng } from '@gayatama/scoring';
import { BUSINESS_TYPE_LABELS } from '../../lib/copy';
import { formatCoordinate } from '../../lib/format';
import { isBusinessType } from '../../lib/location';

interface LocationControlsProps {
  point: LatLng | null;
  businessType: BusinessType;
  onBusinessTypeChange: (businessType: BusinessType) => void;
  onUseMapCenter: () => void;
  onClearPoint: () => void;
}

export function LocationControls({
  point,
  businessType,
  onBusinessTypeChange,
  onUseMapCenter,
  onClearPoint,
}: LocationControlsProps) {
  return (
    <section className="controls">
      <label className="field">
        <span className="field-label">Jenis usaha</span>
        <select
          value={businessType}
          onChange={(event) => {
            if (isBusinessType(event.target.value)) onBusinessTypeChange(event.target.value);
          }}
        >
          {BUSINESS_TYPES.map((type) => (
            <option key={type} value={type}>
              {BUSINESS_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </label>

      <div className="location-row">
        <div>
          <span className="field-label">Lokasi</span>
          <span className="coordinate">{point === null ? 'Belum dipilih' : formatCoordinate(point)}</span>
        </div>
        <div className="location-actions">
          {point !== null && (
            <button
              type="button"
              className="button-secondary button-clear-point"
              onClick={onClearPoint}
              aria-label="Hapus titik lokasi yang dipilih"
            >
              Hapus titik
            </button>
          )}
          <button type="button" className="button-secondary" onClick={onUseMapCenter}>
            Pakai titik tengah
          </button>
        </div>
      </div>
    </section>
  );
}
