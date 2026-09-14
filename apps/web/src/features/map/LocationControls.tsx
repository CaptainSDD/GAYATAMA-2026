import { BUSINESS_TYPES, type BusinessType, type LatLng } from '@gayatama/scoring';
import { BUSINESS_TYPE_LABELS } from '../../lib/copy';
import { formatCoordinate } from '../../lib/format';

interface BusinessTypePickerProps {
  businessType: BusinessType;
  onBusinessTypeChange: (businessType: BusinessType) => void;
}

/**
 * All seven categories laid out at once rather than folded into a <select>:
 * choosing one is the main thing this screen asks of a visitor, and the score
 * changes with it, so the options are worth the space.
 */
export function BusinessTypePicker({ businessType, onBusinessTypeChange }: BusinessTypePickerProps) {
  return (
    <div className="type-grid" data-tour="business-type">
      {BUSINESS_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          className="type-option"
          aria-pressed={type === businessType}
          onClick={() => onBusinessTypeChange(type)}
        >
          {BUSINESS_TYPE_LABELS[type]}
        </button>
      ))}
    </div>
  );
}

interface LocationSummaryProps {
  point: LatLng | null;
  onUseMapCenter: () => void;
}

export function LocationSummary({ point, onUseMapCenter }: LocationSummaryProps) {
  return (
    <div className="location-row" data-tour="location">
      <div>
        <span className="field-label">Lokasi</span>
        <span className="coordinate">{point === null ? 'Belum dipilih' : formatCoordinate(point)}</span>
      </div>
      <button type="button" className="button-secondary" onClick={onUseMapCenter}>
        Pakai titik tengah
      </button>
    </div>
  );
}
