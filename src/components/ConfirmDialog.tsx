import { useId } from 'react';

type Props = {
  open: boolean; title: string; message: string; confirmLabel: string;
  onConfirm: () => void; onCancel: () => void;
};

export default function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onCancel }: Props) {
  const titleId = useId();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby={titleId}
        className="flex w-full max-w-md flex-col gap-3 rounded-3xl bg-surface p-5">
        <h2 id={titleId} className="text-2xl">{title}</h2>
        <p className="text-muted">{message}</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="h-11 rounded-full border border-line px-5">Cancel</button>
          <button type="button" onClick={onConfirm} className="h-11 rounded-full bg-projects px-5 text-white">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
