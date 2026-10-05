import { useState } from 'react';
import { clampRow, rowProgress } from '../../lib/calc';

type Props = { current: number | null; total: number | null; onChange: (row: number) => void };

export default function RowCounter({ current, total, onChange }: Props) {
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const row = current ?? 0;

  function commit() {
    setTyping(false);
    if (draft.trim() !== '' && !Number.isNaN(Number(draft))) onChange(clampRow(Number(draft)));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <button type="button" aria-label="Previous row" onClick={() => row > 0 && onChange(row - 1)}
          className="h-16 w-16 rounded-full border border-line bg-bg text-3xl">−</button>
        <div className="flex flex-col items-center">
          <span className="text-sm uppercase tracking-wide text-muted">Row</span>
          {typing ? (
            <input autoFocus aria-label="Row number" type="number" min={0} value={draft}
              onChange={(e) => setDraft(e.target.value)} onBlur={commit}
              onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
              className="h-16 w-24 rounded-xl border border-line text-center text-4xl" />
          ) : (
            <button type="button" aria-label={`Row ${row}, tap to type`}
              onClick={() => { setDraft(String(row)); setTyping(true); }} className="min-h-11 text-6xl leading-none">
              {row}{total !== null && <span className="text-2xl text-muted"> / {total}</span>}
            </button>
          )}
        </div>
        <button type="button" aria-label="Next row" onClick={() => onChange(row + 1)}
          className="h-16 w-16 rounded-full bg-projects text-3xl text-white">+</button>
      </div>
      <div className="h-1.5 overflow-hidden rounded bg-sun-track">
        <div className="h-1.5 bg-stash" style={{ width: `${rowProgress(current, total)}%` }} />
      </div>
    </div>
  );
}
