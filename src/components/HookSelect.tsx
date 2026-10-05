import { useId } from 'react';
import { formatHook, hookSizeOptions } from '../lib/calc';

type Props = { label: string; value: number | null; onChange: (mm: number | null) => void };

export default function HookSelect({ label, value, onChange }: Props) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm text-muted">{label}</label>
      <select
        id={id}
        value={value === null ? '' : String(value)}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="h-12 rounded-xl border border-line bg-surface px-3"
      >
        <option value="">—</option>
        {hookSizeOptions().map((mm) => (
          <option key={mm} value={String(mm)}>{formatHook(mm)}</option>
        ))}
      </select>
    </div>
  );
}
