import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import ErrorBox from '../../components/ErrorBox';
import { resizeImage } from '../../lib/images';
import { WEIGHTS, type YarnWeight } from '../../lib/labels';
import { uploadFile } from '../../lib/storage';
import { toYarnInput, useSaveYarn, useYarn, type YarnInput } from './api';

const empty: YarnInput = {
  brand: null, name: '', color: null, yarn_weight: null, fiber: null, skeins_owned: 1, photo_path: null,
  bought_at: null, price_per_skein: null, bought_on: null, notes: null,
};

const input = 'h-12 rounded-xl border border-line bg-surface px-3';
const label = 'flex flex-col gap-1.5 text-sm text-muted';
const text = (v: string) => (v.trim() === '' ? null : v);

export default function YarnForm() {
  const { id } = useParams();
  const existing = useYarn(id);
  if (id && existing.error) return <ErrorBox error={existing.error} onRetry={() => existing.refetch()} />;
  if (id && !existing.data) return <p className="p-4 text-muted">Loading…</p>;
  return <YarnFormBody initial={existing.data ? toYarnInput(existing.data) : empty} />;
}

function YarnFormBody({ initial }: { initial: YarnInput }) {
  const navigate = useNavigate();
  const save = useSaveYarn();
  const [y, setY] = useState<YarnInput>(initial);
  const [photo, setPhoto] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<unknown>(null);
  const set = <K extends keyof YarnInput>(k: K, v: YarnInput[K]) => setY({ ...y, [k]: v });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setUploadError(null);
    let photo_path = y.photo_path;
    if (photo) {
      try {
        photo_path = await uploadFile('yarn-photos', await resizeImage(photo), 'jpg');
      } catch (err) {
        setUploadError(err);
        return;
      }
    }
    save.mutate({ ...y, photo_path }, { onSuccess: (newId) => navigate(`/stash/${newId}`) });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 p-4">
      <header className="flex items-center justify-between">
        <button type="button" onClick={() => navigate(-1)} className="min-h-11 text-stash">Cancel</button>
        <h1 className="text-2xl">{initial.id ? 'Edit yarn' : 'New yarn'}</h1>
        <button type="submit" disabled={save.isPending} className="min-h-11 text-stash">Save</button>
      </header>
      {uploadError != null && <ErrorBox error={uploadError} />}
      {save.error && <ErrorBox error={save.error} />}
      <label className={label}>Name<input required className={input} value={y.name} onChange={(e) => set('name', e.target.value)} /></label>
      <label className={label}>Brand<input className={input} value={y.brand ?? ''} onChange={(e) => set('brand', text(e.target.value))} /></label>
      <label className={label}>Color<input className={input} value={y.color ?? ''} onChange={(e) => set('color', text(e.target.value))} /></label>
      <div className="flex gap-2">
        <label className={`${label} flex-1`}>Weight
          <select className={input} value={y.yarn_weight ?? ''} onChange={(e) => set('yarn_weight', (e.target.value || null) as YarnWeight | null)}>
            <option value="">—</option>
            {WEIGHTS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
        </label>
        <label className={`${label} flex-1`}>Fiber<input className={input} value={y.fiber ?? ''} onChange={(e) => set('fiber', text(e.target.value))} /></label>
      </div>
      <label className={label}>Skeins owned
        <input required type="number" min={0} step={0.25} className={input} value={y.skeins_owned}
          onChange={(e) => set('skeins_owned', Number(e.target.value))} />
      </label>
      <label className={label}>Photo<input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} /></label>
      <label className={label}>Shop<input className={input} value={y.bought_at ?? ''} onChange={(e) => set('bought_at', text(e.target.value))} /></label>
      <div className="flex gap-2">
        <label className={`${label} flex-1`}>Price per skein (€)
          <input type="number" min={0} step={0.01} className={input} value={y.price_per_skein ?? ''}
            onChange={(e) => set('price_per_skein', e.target.value === '' ? null : Number(e.target.value))} />
        </label>
        <label className={`${label} flex-1`}>Bought on
          <input type="date" className={input} value={y.bought_on ?? ''} onChange={(e) => set('bought_on', e.target.value || null)} />
        </label>
      </div>
      <label className={label}>Notes<textarea rows={3} className="rounded-xl border border-line bg-surface p-3" value={y.notes ?? ''} onChange={(e) => set('notes', text(e.target.value))} /></label>
    </form>
  );
}
