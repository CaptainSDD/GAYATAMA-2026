import { BUSINESS_TYPES, type BusinessType, type LatLng } from '@gayatama/scoring';
import { BUSINESS_TYPE_LABELS } from '../../lib/copy';
import { formatCoordinate } from '../../lib/format';
import { isBusinessType } from '../../lib/location';

/** How many points the location card is collecting. */
export type PointMode = 'satu' | 'dua';

interface PointModeTabsProps {
  mode: PointMode;
  onModeChange: (mode: PointMode) => void;
  /** A second point only means something once the first one exists. */
  disableTwo: boolean;
}

/**
 * Lives in the panel bar, beside the "Lokasi" heading. Choosing the mode is
 * what turns the second point on, so the old "Bandingkan 2 lokasi" button is
 * gone: the same decision is now made once, in the place that names it.
 */
export function PointModeTabs({ mode, onModeChange, disableTwo }: PointModeTabsProps) {
  return (
    <div className="point-mode" role="group" aria-label="Jumlah titik">
      {(['satu', 'dua'] as const).map((value) => (
        <button
          key={value}
          type="button"
          className="point-mode-tab"
          aria-pressed={mode === value}
          disabled={disableTwo && value === 'dua'}
          onClick={() => onModeChange(value)}
        >
          {value === 'satu' ? '1 titik' : '2 titik'}
        </button>
      ))}
    </div>
  );
}

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

interface PointRowProps {
  label: string | null;
  point: LatLng | null;
  hint: string;
  onClear: () => void;
}

function PointRow({ label, point, hint, onClear }: PointRowProps) {
  return (
    <div className="point-row">
      {label !== null && <span className="point-row-label">{label}</span>}
      {/* Not `location-coordinate`: that name already belongs to the small
          muted line inside the preview card, and its rule would win here. */}
      <p className="picked-coordinate" data-empty={point === null}>
        {point === null ? 'Belum dipilih' : formatCoordinate(point)}
      </p>
      {point === null ? (
        <p className="location-hint">{hint}</p>
      ) : (
        <div className="location-card-actions">
          <button
            type="button"
            className="button-secondary button-clear-point"
            onClick={onClear}
            aria-label={label === null ? 'Hapus titik lokasi yang dipilih' : `Hapus ${label}`}
          >
            Hapus
          </button>
        </div>
      )}
    </div>
  );
}

interface LocationSummaryProps {
  mode: PointMode;
  point: LatLng | null;
  secondPoint: LatLng | null;
  onClearPoint: () => void;
  onClearSecondPoint: () => void;
}

/**
 * Which place — or which two places — this analysis is about. In `dua` mode the
 * second row is always present, so a visitor can see that a second point is
 * expected instead of hunting for a control that asks for one.
 */
export function LocationSummary({
  mode,
  point,
  secondPoint,
  onClearPoint,
  onClearSecondPoint,
}: LocationSummaryProps) {
  if (mode === 'satu') {
    return (
      <div className="location-card" data-tour="location">
        <PointRow label="Koordinat Lokasi" point={point} hint="Klik peta untuk memilih titik." onClear={onClearPoint} />
      </div>
    );
  }

  return (
    <div className="location-card" data-tour="location">
      <PointRow label="Koordinat Lokasi 1" point={point} hint="Klik peta untuk memilih titik pertama." onClear={onClearPoint} />
      <PointRow
        label="Koordinat Lokasi 2"
        point={secondPoint}
        hint="Klik peta untuk memilih titik kedua."
        onClear={onClearSecondPoint}
      />
    </div>
  );
}
