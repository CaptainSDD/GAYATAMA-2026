import { BUSINESS_TYPES, type BusinessType, type LatLng } from '@gayatama/scoring';
import { BUSINESS_TYPE_LABELS } from '../../lib/copy';
import { formatCoordinate } from '../../lib/format';
import { isBusinessType } from '../../lib/location';

interface BusinessTypePickerProps {
  businessType: BusinessType;
  onBusinessTypeChange: (businessType: BusinessType) => void;
}

export function BusinessTypePicker({ businessType, onBusinessTypeChange }: BusinessTypePickerProps) {
  return (
    <label className="field location-field" data-tour="business-type">
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
  );
}

interface LocationSummaryProps {
  point: LatLng | null;
  onClearPoint: () => void;
  /** Two sites are being compared for the chosen category. */
  comparingSites: boolean;
  onToggleCompareSites: () => void;
}

/**
 * The coordinate is the answer to "which place am I looking at", so it is set
 * large enough to read at a glance rather than tucked beside its own label.
 */
export function LocationSummary({ point, onClearPoint, comparingSites, onToggleCompareSites }: LocationSummaryProps) {
  return (
    <div className="location-card" data-tour="location">
      {/* Not `location-coordinate`: that name already belongs to the small
          muted line inside the preview card, and its rule would win here. */}
      <p className="picked-coordinate" data-empty={point === null}>
        {point === null ? 'Belum dipilih' : formatCoordinate(point)}
      </p>
      {/* The map click is the only way in now that the centre button is gone, so
          the card says so rather than leaving an empty state unexplained. */}
      {point === null && <p className="location-hint">Klik peta untuk memilih titik.</p>}
      {comparingSites && point !== null && (
        <p className="location-hint">Klik peta untuk menentukan lokasi B.</p>
      )}
      {/* Own class rather than the shared .location-actions, which carries a
          right-alignment rule from elsewhere that pulled these two apart. */}
      {point !== null && (
        <div className="location-card-actions">
          <button
            type="button"
            className="button-secondary button-clear-point"
            onClick={onClearPoint}
            aria-label="Hapus titik lokasi yang dipilih"
          >
            Hapus titik
          </button>
          <button type="button" className="button-secondary" onClick={onToggleCompareSites}>
            {comparingSites ? 'Batal bandingkan' : 'Bandingkan 2 lokasi'}
          </button>
        </div>
      )}
    </div>
  );
}
