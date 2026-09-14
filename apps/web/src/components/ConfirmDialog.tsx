import { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Built on the native <dialog>, which already brings the focus trap, the
 * backdrop and Escape-to-close — all the parts a hand-rolled modal gets wrong.
 */
export function ConfirmDialog({ open, title, body, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (element === null) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    // `cancel` covers Escape and the backdrop, so those paths report back rather
    // than leaving React thinking the dialog is still open.
    <dialog ref={dialog} className="confirm-dialog" onCancel={(event) => { event.preventDefault(); onCancel(); }}>
      <h2 className="confirm-title">{title}</h2>
      <p className="confirm-body">{body}</p>
      <div className="confirm-actions">
        <button type="button" className="button-secondary" onClick={onCancel}>
          Batal
        </button>
        <button type="button" className="button-danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
