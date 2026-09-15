import { useId } from 'react';

interface AuthFieldProps {
  label: string;
  type: 'email' | 'password' | 'text';
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoComplete?: string;
}

/** One labelled input with inline validation, shared by the login and signup forms. */
export function AuthField({ label, type, value, onChange, error, autoComplete }: AuthFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const invalid = error !== undefined;

  return (
    <label className="field" htmlFor={id}>
      <span className="field-label">{label}</span>
      <input
        id={id}
        type={type}
        className="text-input"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        aria-invalid={invalid}
        aria-describedby={invalid ? errorId : undefined}
      />
      {invalid && (
        <p id={errorId} className="field-error" role="alert">
          {error}
        </p>
      )}
    </label>
  );
}
