import { useState, type FormEvent } from 'react';

type Props = {
  initial?: { started_at: string; minutes: number };
  onSave: (s: { started_at: string; ended_at: string }) => void;
  onCancel: () => void;
};

/** "2026-09-22T21:05" in local time, the format of <input type="datetime-local">. */
function toLocalInput(d: Date): string {
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

export default function SessionForm({ initial, onSave, onCancel }: Props) {
  const [start, setStart] = useState(toLocalInput(initial ? new Date(initial.started_at) : new Date(Date.now() - 30 * 60_000)));
  const [minutes, setMinutes] = useState(String(initial?.minutes ?? 30));
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const m = Number(minutes);
    if (!Number.isFinite(m) || m < 1) {
      setError('The duration must be at least 1 minute.');
      return;
    }
    const startDate = new Date(start);
    if (Number.isNaN(startDate.getTime())) {
      setError('Choose when you started.');
      return;
    }
    onSave({ started_at: startDate.toISOString(), ended_at: new Date(startDate.getTime() + m * 60_000).toISOString() });
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3">
      <label className="flex flex-col gap-1 text-sm text-muted">Started
        <input type="datetime-local" required value={start} onChange={(e) => setStart(e.target.value)}
          className="h-11 rounded-xl border border-line px-2 text-ink" />
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">Duration (minutes)
        <input type="number" min={1} value={minutes} onChange={(e) => setMinutes(e.target.value)}
          className="h-11 rounded-xl border border-line px-2 text-ink" />
      </label>
      {error && <p role="alert" className="text-projects-dark">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="h-11 rounded-full border border-line px-4">Cancel</button>
        <button type="submit" className="h-11 rounded-full bg-projects px-4 text-white">Save time</button>
      </div>
    </form>
  );
}
