import { useState, type FormEvent } from 'react';

type Props = {
  yarns: { id: string; name: string }[];
  onSave: (u: { yarnId: string; skeins: number }) => void;
  onCancel: () => void;
};

export default function YarnUsageForm({ yarns, onSave, onCancel }: Props) {
  const [yarnId, setYarnId] = useState('');
  const [skeins, setSkeins] = useState('0.25');

  function submit(e: FormEvent) {
    e.preventDefault();
    if (yarnId && Number(skeins) >= 0) onSave({ yarnId, skeins: Number(skeins) });
  }

  return (
    <form onSubmit={submit} className="flex items-end gap-2 rounded-2xl border border-line bg-surface p-3">
      <label className="flex flex-1 flex-col gap-1 text-sm text-muted">Yarn
        <select required value={yarnId} onChange={(e) => setYarnId(e.target.value)}
          className="h-11 rounded-xl border border-line px-2 text-ink">
          <option value="">Choose…</option>
          {yarns.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
        </select>
      </label>
      <label className="flex w-24 flex-col gap-1 text-sm text-muted">Skeins used
        <input type="number" min={0} step={0.05} value={skeins} onChange={(e) => setSkeins(e.target.value)}
          className="h-11 rounded-xl border border-line px-2 text-ink" />
      </label>
      <button type="button" onClick={onCancel} className="h-11 px-2 text-muted">Cancel</button>
      <button type="submit" className="h-11 rounded-full bg-projects px-4 text-white">Save yarn</button>
    </form>
  );
}
