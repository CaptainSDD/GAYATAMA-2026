import { useId, useState } from 'react';

interface AuthFieldProps {
  label: string;
  type: 'email' | 'password' | 'text';
  value: string;
  onChange: (value: string) => void;
  error?: string;
  /** The rule the field enforces, said before it is broken rather than after. */
  hint?: string;
  autoComplete?: string;
  autoFocus?: boolean;
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M1.8 10S4.9 4.8 10 4.8 18.2 10 18.2 10 15.1 15.2 10 15.2 1.8 10 1.8 10Z" />
      <circle cx="10" cy="10" r="2.6" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M7.4 5.4A8.3 8.3 0 0 1 10 4.8c5.1 0 8.2 5.2 8.2 5.2a15 15 0 0 1-2.5 3.1" />
      <path d="M12.9 12.9a3 3 0 0 1-4.2-4.2" />
      <path d="M4.6 6.6A14.6 14.6 0 0 0 1.8 10s3.1 5.2 8.2 5.2c.9 0 1.7-.2 2.5-.4" />
      <path d="m3.4 3.4 13.2 13.2" />
    </svg>
  );
}

/**
 * One labelled input in the Studio Sheet, shared by both doors.
 *
 * The password rule is stated as a hint rather than only as an error: the signup
 * form's floor is stricter than Firebase's own, and a visitor should meet it
 * before being told off for missing it. The reveal control exists for the same
 * reason — eight characters with a letter and a digit is a real thing to type on
 * a phone keyboard.
 */
export function AuthField({ label, type, value, onChange, error, hint, autoComplete, autoFocus }: AuthFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const invalid = error !== undefined;
  const isPassword = type === 'password';
  const [revealed, setRevealed] = useState(false);
  const described = [invalid ? errorId : null, hint !== undefined ? hintId : null].filter(
    (token): token is string => token !== null,
  );

  return (
    <div className="sheet-field">
      <label className="sheet-field-label" htmlFor={id}>
        {label}
      </label>

      <div className="sheet-input-row" data-invalid={invalid}>
        <input
          id={id}
          type={isPassword && revealed ? 'text' : type}
          className="sheet-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          spellCheck={false}
          aria-invalid={invalid}
          aria-describedby={described.length > 0 ? described.join(' ') : undefined}
        />
        {isPassword && (
          <button
            type="button"
            className="sheet-reveal"
            onClick={() => setRevealed((shown) => !shown)}
            aria-pressed={revealed}
            aria-label={revealed ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
          >
            {revealed ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>

      {hint !== undefined && (
        <p className="sheet-field-hint" id={hintId}>
          {hint}
        </p>
      )}
      {invalid && (
        <p className="sheet-field-error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
