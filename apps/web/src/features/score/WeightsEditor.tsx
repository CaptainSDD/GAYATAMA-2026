import { COMPONENT_KEYS, COMPONENT_WEIGHTS, type ComponentWeights } from '@gayatama/scoring';
import { useEffect, useState } from 'react';
import { COMPONENT_LABELS } from '../../lib/copy';
import { useIdToken } from '../auth/useIdToken';
import { useSaveWeights } from '../../lib/queries';

/** The documented baseline, as whole numbers for the inputs. */
export const DEFAULT_WEIGHT_INPUTS: ComponentWeights = COMPONENT_KEYS.reduce((acc, key) => {
  acc[key] = Math.round(COMPONENT_WEIGHTS[key] * 100);
  return acc;
}, {} as ComponentWeights);

/** The API accepts 0–100 per criterion, and both controls here honour the same range. */
const MIN_WEIGHT = 0;
const MAX_WEIGHT = 100;

export function weightsEqualDefault(weights: ComponentWeights | null): boolean {
  if (weights === null) return true;
  return COMPONENT_KEYS.every((key) => Math.abs(weights[key] - DEFAULT_WEIGHT_INPUTS[key]) < 0.01);
}

/** Whether the draft still matches what the score was computed with. */
export function sameWeights(a: ComponentWeights, b: ComponentWeights): boolean {
  return COMPONENT_KEYS.every((key) => Math.abs(a[key] - b[key]) < 0.01);
}

/**
 * What to hand the engine for a finished draft. `null` for the baseline, so the
 * result is labelled "bobot bawaan" and a shared link does not carry a custom
 * set that merely happens to equal the default.
 */
export function weightsToApply(draft: ComponentWeights): ComponentWeights | null {
  return weightsEqualDefault(draft) ? null : draft;
}

interface WeightsEditorProps {
  /** The set the score on screen was computed with. */
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
 *
 * Edits are held as a draft and applied on request. Every nudge of a slider used
 * to be a new analysis: five criteria meant a burst of requests, a score
 * flickering through values nobody asked about, and no way to set up a
 * considered set of weights before seeing what it did. A weight set is one
 * argument, so it is put to the engine once, when it is finished.
 */
export function WeightsEditor({ weights, onChange }: WeightsEditorProps) {
  const idToken = useIdToken();
  const save = useSaveWeights(idToken);
  const applied = weights ?? DEFAULT_WEIGHT_INPUTS;
  const [draft, setDraft] = useState<ComponentWeights>(applied);

  // Re-syncs when the applied set changes from outside this component: a saved
  // set arriving from the profile, a shared link, or a different point analysed.
  // `weights` is held in App state, so this fires on a real change rather than
  // on every render.
  useEffect(() => {
    setDraft(weights ?? DEFAULT_WEIGHT_INPUTS);
  }, [weights]);

  const total = COMPONENT_KEYS.reduce((sum, key) => sum + draft[key], 0);
  const appliedIsDefault = weightsEqualDefault(weights);
  const draftIsDefault = weightsEqualDefault(draft);
  const unapplied = !sameWeights(draft, applied);

  const setOne = (key: (typeof COMPONENT_KEYS)[number], value: number) => {
    // NaN arrives from an emptied number field; treat it as the floor rather
    // than letting it poison the total and blank every percentage.
    const safe = Number.isFinite(value) ? value : MIN_WEIGHT;
    setDraft((current) => ({ ...current, [key]: Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, safe)) }));
  };

  const apply = () => {
    onChange(weightsToApply(draft));
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
            <label className="weights-label" htmlFor={`weight-slider-${key}`}>
              {COMPONENT_LABELS[key]}
            </label>
            {/* Two ways into the same number: drag for a feel of the trade-off,
                type when the exact figure is the point. */}
            <input
              id={`weight-${key}`}
              className="weights-number"
              type="number"
              inputMode="numeric"
              min={MIN_WEIGHT}
              max={MAX_WEIGHT}
              step={1}
              value={draft[key]}
              aria-label={`Bobot ${COMPONENT_LABELS[key]}, angka relatif`}
              onChange={(event) => setOne(key, Number(event.target.value))}
            />
            <output className="weights-value" htmlFor={`weight-slider-${key}`}>
              {total > 0 ? Math.round((draft[key] / total) * 100) : 0}%
            </output>
            <input
              id={`weight-slider-${key}`}
              className="weights-slider"
              type="range"
              min={MIN_WEIGHT}
              max={MAX_WEIGHT}
              step={1}
              value={draft[key]}
              onChange={(event) => setOne(key, Number(event.target.value))}
            />
          </li>
        ))}
      </ul>

      <div className="weights-actions">
        {/* The primary action of this block: nothing below the sliders changes
            the score until it is pressed. */}
        <button type="button" className="button-primary weights-apply" onClick={apply} disabled={!unapplied}>
          Analisa lagi
        </button>

        <button
          type="button"
          className="button-secondary"
          onClick={() => setDraft(DEFAULT_WEIGHT_INPUTS)}
          disabled={draftIsDefault}
        >
          Kembalikan ke bawaan
        </button>

        {idToken !== null && (
          <button
            type="button"
            className="button-secondary"
            onClick={() => save.mutate(weights)}
            // Only ever saves the set the score was actually computed with, so
            // the account cannot end up holding weights nobody has seen a
            // result for.
            disabled={save.isPending || unapplied}
            title={unapplied ? 'Tekan "Analisa lagi" dulu, lalu simpan bobot yang dipakai skornya.' : undefined}
          >
            {save.isPending ? 'Menyimpan…' : save.isSuccess ? 'Tersimpan' : 'Simpan ke akun'}
          </button>
        )}
      </div>

      {unapplied && (
        <p className="notice weights-warning" role="status">
          Bobot di atas belum dipakai. Tekan <strong>Analisa lagi</strong> untuk menghitung ulang skornya.
        </p>
      )}

      {save.isError && (
        <p className="notice weights-warning" role="status">
          Bobotnya belum tersimpan ke akun. Skornya tetap memakai bobot di atas, dan tautan halaman ini masih membawanya.
        </p>
      )}

      {!appliedIsDefault && (
        <p className="notice weights-warning" role="status">
          Skor dengan bobot ubahan tidak setara dengan skor bawaan. Jangan bandingkan angkanya dengan hasil orang lain
          tanpa memakai bobot yang sama.
        </p>
      )}
    </div>
  );
}
