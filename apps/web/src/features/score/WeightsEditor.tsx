import { COMPONENT_KEYS, COMPONENT_WEIGHTS, type ComponentWeights } from '@gayatama/scoring';
import { COMPONENT_LABELS } from '../../lib/copy';
import { useIdToken } from '../auth/useIdToken';
import { useSaveWeights } from '../../lib/queries';

/** The documented baseline, as whole numbers for the inputs. */
export const DEFAULT_WEIGHT_INPUTS: ComponentWeights = COMPONENT_KEYS.reduce((acc, key) => {
  acc[key] = Math.round(COMPONENT_WEIGHTS[key] * 100);
  return acc;
}, {} as ComponentWeights);

export function weightsEqualDefault(weights: ComponentWeights | null): boolean {
  if (weights === null) return true;
  return COMPONENT_KEYS.every((key) => Math.abs(weights[key] - DEFAULT_WEIGHT_INPUTS[key]) < 0.01);
}

interface WeightsEditorProps {
  weights: ComponentWeights | null;
  onChange: (weights: ComponentWeights | null) => void;
}

/**
 * Lets the reader argue with the weights.
 *
 * This is not a liberty the product takes lightly, and it is also not out of
 * character: the methodology describes 35/20/20/15/10 as documented judgement
 * "chosen from domain reasoning and documented so they can be argued with, not
 * parameters fitted to observed outcomes". Handing the reader the argument is
 * the same claim, made usable.
 *
 * The numbers are relative, not percentages. The engine normalises whatever it
 * is given so the set sums to 1, which is what keeps a customised score on the
 * 0–100 scale its bands are read against — a detail the note below states
 * rather than hides.
 */
export function WeightsEditor({ weights, onChange }: WeightsEditorProps) {
  const idToken = useIdToken();
  const save = useSaveWeights(idToken);
  const current = weights ?? DEFAULT_WEIGHT_INPUTS;
  const total = COMPONENT_KEYS.reduce((sum, key) => sum + current[key], 0);
  const isDefault = weightsEqualDefault(weights);

  const setOne = (key: (typeof COMPONENT_KEYS)[number], value: number) => {
    const next = { ...current, [key]: Math.max(0, Math.min(100, value)) } as ComponentWeights;
    onChange(weightsEqualDefault(next) ? null : next);
    save.reset();
  };

  return (
    <div className="weights-editor">
      <p className="weights-intro">
        Bobot bawaan adalah penilaian yang didokumentasikan, bukan hasil pengepasan data — memang dibuat untuk
        dibantah. Angka di bawah bersifat relatif: LOKABIS menormalkannya agar totalnya tetap 100, sehingga skornya
        tetap berada pada skala yang sama.
      </p>

      <ul className="weights-list">
        {COMPONENT_KEYS.map((key) => (
          <li key={key} className="weights-row">
            <label className="weights-label" htmlFor={`weight-${key}`}>
              {COMPONENT_LABELS[key]}
            </label>
            <input
              id={`weight-${key}`}
              className="weights-slider"
              type="range"
              min={0}
              max={60}
              step={1}
              value={current[key]}
              onChange={(event) => setOne(key, Number(event.target.value))}
            />
            <output className="weights-value" htmlFor={`weight-${key}`}>
              {Math.round((current[key] / total) * 100)}%
            </output>
          </li>
        ))}
      </ul>

      <div className="weights-actions">
        <button type="button" className="button-secondary" onClick={() => onChange(null)} disabled={isDefault}>
          Kembalikan ke bawaan
        </button>

        {idToken !== null && (
          <button
            type="button"
            className="button-secondary"
            onClick={() => save.mutate(weights)}
            disabled={save.isPending}
          >
            {save.isPending ? 'Menyimpan…' : save.isSuccess ? 'Tersimpan' : 'Simpan ke akun'}
          </button>
        )}
      </div>

      {save.isError && (
        <p className="notice weights-warning" role="status">
          Bobotnya belum tersimpan ke akun. Skornya tetap memakai bobot di atas, dan tautan halaman ini masih membawanya.
        </p>
      )}

      {!isDefault && (
        <p className="notice weights-warning" role="status">
          Skor dengan bobot ubahan tidak setara dengan skor bawaan. Jangan bandingkan angkanya dengan hasil orang lain
          tanpa memakai bobot yang sama.
        </p>
      )}
    </div>
  );
}
