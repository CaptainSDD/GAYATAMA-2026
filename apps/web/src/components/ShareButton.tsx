import { useEffect, useState } from 'react';
import { CheckIcon, LinkIcon } from './Icons';

/**
 * The selected point and business type already live in the URL (see App.tsx),
 * so a result has always been shareable — there was simply no way to discover
 * it. This is that affordance.
 */
export function ShareButton({ disabled }: { disabled: boolean }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      // Clipboard access can be refused (insecure context, permission denied).
      // Selecting the address bar is the fallback, so say so rather than fail
      // silently.
      window.prompt('Salin tautan ini:', window.location.href);
    }
  };

  const label = copied ? 'Tautan tersalin' : 'Salin tautan hasil analisis';

  return (
    <button
      type="button"
      className="icon-button"
      onClick={() => void copy()}
      disabled={disabled}
      data-copied={copied}
      aria-label={label}
      title={disabled ? 'Pilih lokasi dulu untuk membagikan hasil' : label}
    >
      {copied ? <CheckIcon /> : <LinkIcon />}
    </button>
  );
}
