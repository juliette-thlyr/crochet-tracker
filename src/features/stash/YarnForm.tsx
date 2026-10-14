import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { MultiColourDots } from '../../components/ColourDots';
import ErrorBox from '../../components/ErrorBox';
import NumberField from '../../components/NumberField';
import PhotoField from '../../components/PhotoField';
import SuggestField from '../../components/SuggestField';
import { resizeImage } from '../../lib/images';
import { WEIGHTS, type YarnWeight } from '../../lib/labels';
import { uploadFile } from '../../lib/storage';
import { useCatalog, useFibers, useShops } from '../lists/api';
import { toYarnInput, useSaveYarn, useYarn, type YarnInput } from './api';

const empty: YarnInput = {
  brand: null, name: '', color: null, color_families: [], yarn_weight: null, fiber: null, skeins_owned: 1, photo_path: null,
  bought_at: null, price_per_skein: null, bought_on: null, notes: null,
};

const input = 'h-12 rounded-xl border border-line bg-surface px-3';
const label = 'flex flex-col gap-1.5 text-sm text-muted';
const text = (v: string) => (v.trim() === '' ? null : v);
const OTHER = '__other__';
const same = (a: string | null, b: string | null) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

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
  const catalog = useCatalog().data ?? [];
  const shops = useShops().data ?? [];
  const fiberList = useFibers().data ?? [];
  const [y, setY] = useState<YarnInput>(initial);
  const [otherFiber, setOtherFiber] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<unknown>(null);
  const set = <K extends keyof YarnInput>(k: K, v: YarnInput[K]) => setY((cur) => ({ ...cur, [k]: v }));

  const brands = [...new Set(catalog.map((c) => c.brand))];
  const names = catalog.filter((c) => !y.brand?.trim() || same(c.brand, y.brand)).map((c) => c.name);
  // The yarn's own fiber is always offered, even if it was removed from the list.
  const fibers = [...new Set([...fiberList.map((f) => f.name), ...(y.fiber && !otherFiber ? [y.fiber] : [])])]
    .sort((a, b) => a.localeCompare(b));

  function pickName(name: string) {
    const found = catalog.find((c) => same(c.name, name) && (!y.brand?.trim() || same(c.brand, y.brand)));
    if (!found) return;
    setY((cur) => ({
      ...cur,
      brand: cur.brand ?? found.brand,
      yarn_weight: cur.yarn_weight ?? found.yarn_weight,
      fiber: cur.fiber ?? found.fiber,
    }));
  }

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
    const fiber = y.fiber?.trim() || null;
    const listed = fiber && fiberList.find((f) => same(f.name, fiber))?.name;
    save.mutate({ ...y, fiber: listed ?? fiber, photo_path }, { onSuccess: (newId) => navigate(`/stash/${newId}`) });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 p-4">
      <header className="flex items-center justify-between">
        <button type="button" onClick={() => navigate(-1)} className="min-h-11 text-stash">Cancel</button>
        <h1 className="text-2xl text-stash">{initial.id ? 'Edit yarn' : 'New yarn'}</h1>
        <button type="submit" disabled={save.isPending} className="min-h-11 text-stash">Save</button>
      </header>
      {uploadError != null && <ErrorBox error={uploadError} />}
      {save.error && <ErrorBox error={save.error} />}
      <SuggestField label="Brand" value={y.brand ?? ''} onChange={(v) => set('brand', text(v))} suggestions={brands} />
      <SuggestField label="Name" required value={y.name} onChange={(v) => set('name', v)} suggestions={names} onPick={pickName} />
      <label className={label}>Color<input className={input} value={y.color ?? ''} onChange={(e) => set('color', text(e.target.value))} /></label>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Colour family · up to 2</span>
        <MultiColourDots label="Colour family" value={y.color_families} onChange={(v) => set('color_families', v)} />
      </div>
      <div className="flex gap-2">
        <label className={`${label} flex-1`}>Weight
          <select className={input} value={y.yarn_weight ?? ''} onChange={(e) => set('yarn_weight', (e.target.value || null) as YarnWeight | null)}>
            <option value="">—</option>
            {WEIGHTS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
        </label>
        <label className={`${label} flex-1`}>Fiber
          <select className={input} value={otherFiber ? OTHER : y.fiber ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              setOtherFiber(v === OTHER);
              set('fiber', v === OTHER || v === '' ? null : v);
            }}>
            <option value="">—</option>
            {fibers.map((f) => <option key={f} value={f}>{f}</option>)}
            <option value={OTHER}>Other…</option>
          </select>
        </label>
      </div>
      {otherFiber && (
        <label className={label}>New fiber
          <input autoFocus className={input} value={y.fiber ?? ''} onChange={(e) => set('fiber', e.target.value)} />
        </label>
      )}
      <label className={label}>Skeins owned
        <NumberField required value={y.skeins_owned} min={0} step={0.25} emptyValue={0}
          onChange={(v) => set('skeins_owned', v ?? 0)} className={input} />
      </label>
      <PhotoField label="Photo" bucket="yarn-photos" path={y.photo_path} file={photo}
        onFile={setPhoto} onRemove={() => set('photo_path', null)} />
      <SuggestField label="Shop" value={y.bought_at ?? ''} onChange={(v) => set('bought_at', text(v))} suggestions={shops.map((s) => s.name)} />
      <div className="flex gap-2">
        <label className={`${label} flex-1`}>Price per skein (€)
          <NumberField value={y.price_per_skein} min={0} step={0.01}
            onChange={(v) => set('price_per_skein', v)} className={input} />
        </label>
        <label className={`${label} flex-1`}>Bought on
          <input type="date" className={input} value={y.bought_on ?? ''} onChange={(e) => set('bought_on', e.target.value || null)} />
        </label>
      </div>
      <label className={label}>Notes<textarea rows={3} className="rounded-xl border border-line bg-surface p-3" value={y.notes ?? ''} onChange={(e) => set('notes', text(e.target.value))} /></label>
    </form>
  );
}
