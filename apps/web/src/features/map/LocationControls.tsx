import { BUSINESS_TYPES, type BusinessType, type LatLng } from '@gayatama/scoring';
import { BUSINESS_TYPE_LABELS } from '../../lib/copy';
import { formatCoordinate } from '../../lib/format';
import { isBusinessType } from '../../lib/location';

interface LocationControlsProps {
  point: LatLng | null;
  businessType: BusinessType;
  onBusinessTypeChange: (businessType: BusinessType) => void;
  onUseMapCenter: () => void;
}

export function LocationControls({ point, businessType, onBusinessTypeChange, onUseMapCenter }: LocationControlsProps) {
  return (
    <section className="controls">
      <label className="field">
        <span className="field-label">Business type</span>
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
          <span className="field-label">Location</span>
          <span className="coordinate">{point === null ? 'None selected' : formatCoordinate(point)}</span>
        </div>
        <button type="button" className="button-secondary" onClick={onUseMapCenter}>
          Use map centre
        </button>
      </div>
    </section>
  );
}
