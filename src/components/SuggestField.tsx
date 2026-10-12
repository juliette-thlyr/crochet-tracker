import { useId, useState } from 'react';

type Props = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  onPick?: (v: string) => void;
  required?: boolean;
  inputClassName?: string;
};

const MAX = 8;

/**
 * A text field with a tap-friendly suggestion list (iOS shows <datalist> poorly).
 * Suggestions match anywhere, ignoring case; an exact match is not repeated.
 */
export default function SuggestField({ label, value, onChange, suggestions, onPick, required, inputClassName }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const q = value.trim().toLowerCase();
  const shown = [...new Set(suggestions)]
    .filter((s) => s.toLowerCase().includes(q) && s.toLowerCase() !== q)
    .slice(0, MAX);

  function pick(s: string) {
    onChange(s);
    onPick?.(s);
    setOpen(false);
  }

  return (
    <div className="relative flex flex-col gap-1.5 text-sm text-muted">
      <label htmlFor={id}>{label}</label>
      <input id={id} name={label} required={required} value={value} autoComplete="off"
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        className={inputClassName ?? 'h-12 rounded-xl border border-line bg-surface px-3 text-ink'} />
      {open && shown.length > 0 && (
        <div role="listbox" aria-label={`${label} suggestions`}
          className="absolute inset-x-0 top-full z-20 mt-1 flex flex-col overflow-hidden rounded-xl border border-line bg-surface text-ink shadow">
          {shown.map((s) => (
            <button key={s} type="button" role="option" aria-selected={false}
              // Keep the input focused so the tap lands on the option before blur closes the list.
              onPointerDown={(e) => e.preventDefault()} onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(s)}
              className="min-h-11 border-b border-divider px-3 text-left last:border-b-0">
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
