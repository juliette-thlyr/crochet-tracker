import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import ErrorBox from '../../components/ErrorBox';
import HookSelect from '../../components/HookSelect';
import PhotoField from '../../components/PhotoField';
import { resizeImage } from '../../lib/images';
import { WEIGHTS, type YarnWeight } from '../../lib/labels';
import { MAX_PDF_BYTES, uploadFile } from '../../lib/storage';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useCreatePatternType, usePattern, usePatternInstructionCounts, usePatternTypes, useSavePattern, type PatternDetail, type PatternInput } from './api';
import { nextTypePosition, type PartDraft } from './logic';
import NumberField from '../../components/NumberField';

const input = 'h-12 rounded-xl border border-line bg-surface px-3';
const label = 'flex flex-col gap-1.5 text-sm text-muted';
const text = (v: string) => (v.trim() === '' ? null : v);
const emptyPart = (): PartDraft => ({ name: '', count: 1, total_rows: null });

function toInput(p: PatternDetail | undefined): PatternInput {
  if (!p) {
    return { name: '', pattern_type_id: null, designer: null, url: null, hook_size_mm: null, yarn_weight: null, notes: null, pdf_path: null, photo_path: null };
  }
  return {
    id: p.id, name: p.name, pattern_type_id: p.pattern_type_id, designer: p.designer, url: p.url,
    hook_size_mm: p.hook_size_mm === null ? null : Number(p.hook_size_mm), yarn_weight: p.yarn_weight,
    notes: p.notes, pdf_path: p.pdf_path, photo_path: p.photo_path,
  };
}

export default function PatternForm() {
  const { id } = useParams();
  const existing = usePattern(id);
  if (id && existing.error) return <ErrorBox error={existing.error} />;
  if (id && !existing.data) return <p className="p-4 text-muted">Loading…</p>;
  const parts = existing.data?.parts.map((p) => ({ id: p.id, name: p.name, count: p.count, total_rows: p.total_rows }));
  return <PatternFormBody initial={toInput(existing.data)} initialParts={parts ?? [emptyPart()]} />;
}

function PatternFormBody({ initial, initialParts }: { initial: PatternInput; initialParts: PartDraft[] }) {
  const navigate = useNavigate();
  const types = usePatternTypes();
  const createType = useCreatePatternType();
  const save = useSavePattern();
  const counts = usePatternInstructionCounts(initial.id);
  const [removing, setRemoving] = useState<number | null>(null);
  const [p, setP] = useState(initial);
  const [parts, setParts] = useState(initialParts);
  const [pdf, setPdf] = useState<File | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<unknown>(null);
  const [nameError, setNameError] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [newType, setNewType] = useState<string | null>(null);
  const set = <K extends keyof PatternInput>(k: K, v: PatternInput[K]) => setP({ ...p, [k]: v });
  const setPart = (i: number, patch: Partial<PartDraft>) => setParts(parts.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  function pickPdf(file: File | null) {
    setPdfError(null);
    if (file && file.size > MAX_PDF_BYTES) {
      setPdfError('This PDF is larger than 20 MB.');
      return;
    }
    setPdf(file);
  }

  function addType() {
    if (!newType?.trim()) return;
    createType.mutate(
      { name: newType, position: nextTypePosition(types.data ?? []) },
      { onSuccess: (t) => { set('pattern_type_id', t.id); setNewType(null); } },
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setUploadError(null);
    const blank = parts.some((x) => x.id && x.name.trim() === '');
    setNameError(blank);
    if (blank) return;
    let pdf_path = p.pdf_path;
    if (pdf) {
      try {
        pdf_path = await uploadFile('pattern-pdfs', pdf, 'pdf');
      } catch (err) {
        setUploadError(err);
        return;
      }
    }
    let photo_path = p.photo_path;
    if (photo) {
      try {
        photo_path = await uploadFile('pattern-photos', await resizeImage(photo), 'jpg');
      } catch (err) {
        setUploadError(err);
        return;
      }
    }
    save.mutate({ pattern: { ...p, pdf_path, photo_path }, parts }, { onSuccess: (newId) => navigate(`/patterns/${newId}`) });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 p-4">
      <header className="flex items-center justify-between">
        <button type="button" onClick={() => navigate(-1)} className="min-h-11 text-patterns">Cancel</button>
        <h1 className="text-2xl">{initial.id ? 'Edit pattern' : 'New pattern'}</h1>
        <button type="submit" disabled={save.isPending} className="min-h-11 text-patterns">Save</button>
      </header>
      {uploadError != null && <ErrorBox error={uploadError} />}
      {save.error && <ErrorBox error={save.error} />}
      {nameError && <p role="alert" className="text-projects-dark">Give every part a name, or remove it with ×.</p>}

      <div className="flex gap-2">
        <label className="flex h-12 flex-1 cursor-pointer items-center justify-center rounded-xl border-[1.5px] border-dashed border-muted bg-surface text-sm">
          {pdf ? pdf.name : p.pdf_path ? 'Replace PDF' : 'Attach PDF'}
          <input type="file" accept="application/pdf" className="sr-only" onChange={(e) => pickPdf(e.target.files?.[0] ?? null)} />
        </label>
        <button type="button" disabled className="h-12 flex-1 rounded-xl border border-line bg-divider text-sm text-muted">
          Fill from PDF · soon
        </button>
      </div>
      {pdfError && <p role="alert" className="text-projects-dark">{pdfError}</p>}

      <label className={label}>Name<input required className={input} value={p.name} onChange={(e) => set('name', e.target.value)} /></label>

      <PhotoField label="Result photo" bucket="pattern-photos" path={p.photo_path} file={photo}
        onFile={setPhoto} onRemove={() => set('photo_path', null)} />

      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Type</span>
        <div role="radiogroup" aria-label="Type" className="flex flex-wrap gap-1.5">
          {(types.data ?? []).map((t) => {
            const on = p.pattern_type_id === t.id;
            return (
              <button key={t.id} type="button" role="radio" aria-checked={on}
                onClick={() => set('pattern_type_id', on ? null : t.id)}
                className={`h-11 rounded-full px-3 text-sm ${on ? 'bg-patterns text-white' : 'border border-line bg-surface'}`}>
                {t.name}
              </button>
            );
          })}
          {newType === null ? (
            <button type="button" onClick={() => setNewType('')}
              className="h-11 rounded-full border-[1.5px] border-dashed border-muted px-3 text-sm text-patterns">+ New type</button>
          ) : (
            <span className="flex gap-1.5">
              <input autoFocus aria-label="New type name" value={newType} onChange={(e) => setNewType(e.target.value)}
                className="h-11 w-32 rounded-full border border-line bg-surface px-3 text-sm" />
              <button type="button" onClick={addType} className="h-11 rounded-full bg-patterns px-3 text-sm text-white">Add</button>
            </span>
          )}
        </div>
      </div>

      {createType.error && <ErrorBox error={createType.error} />}

      <div className="flex gap-2">
        <div className="flex-1">
          <HookSelect label="Recommended hook" value={p.hook_size_mm} onChange={(mm) => set('hook_size_mm', mm)} />
        </div>
        <label className={`${label} flex-1`}>Yarn weight
          <select className={input} value={p.yarn_weight ?? ''} onChange={(e) => set('yarn_weight', (e.target.value || null) as YarnWeight | null)}>
            <option value="">—</option>
            {WEIGHTS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
        </label>
      </div>
      <label className={label}>Designer<input className={input} value={p.designer ?? ''} onChange={(e) => set('designer', text(e.target.value))} /></label>
      <label className={label}>Link<input type="url" placeholder="https://…" className={input} value={p.url ?? ''} onChange={(e) => set('url', text(e.target.value))} /></label>

      <div className="mt-1 flex items-center justify-between">
        <h2 className="text-sm uppercase tracking-wide text-muted">Parts</h2>
        <span className="text-xs text-muted">name · how many · rows</span>
      </div>
      {parts.map((part, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <input aria-label="Part name" value={part.name} onChange={(e) => setPart(i, { name: e.target.value })}
            className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-2.5" />
          <NumberField aria-label="How many" value={part.count} min={1} emptyValue={1}
            onChange={(v) => setPart(i, { count: v ?? 1 })}
            className="h-11 w-12 rounded-xl border border-line bg-surface text-center" />
          <NumberField aria-label="Rows" value={part.total_rows} min={1}
            onChange={(v) => setPart(i, { total_rows: v })}
            className="h-11 w-14 rounded-xl border border-line bg-surface text-center" />
          <button type="button" aria-label="Remove part" className="h-11 w-11 text-muted"
            onClick={() => {
              const n = part.id ? counts.data?.get(part.id) : 0;
              if (part.id && (counts.data === undefined || (n ?? 0) > 0)) setRemoving(i);
              else setParts(parts.filter((_, j) => j !== i));
            }}>×</button>
        </div>
      ))}
      <button type="button" onClick={() => setParts([...parts, emptyPart()])} className="h-11 self-start text-patterns">+ Add part</button>

      <label className={label}>Notes<textarea rows={3} className="rounded-xl border border-line bg-surface p-3" value={p.notes ?? ''} onChange={(e) => set('notes', text(e.target.value))} /></label>

      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing !== null ? parts[removing].name : ''}?`}
        message={counts.data === undefined ? 'If it has instructions, they are deleted too when you save.' : 'Its instructions are deleted too when you save.'}
        confirmLabel="Remove"
        onCancel={() => setRemoving(null)}
        onConfirm={() => { setParts(parts.filter((_, j) => j !== removing)); setRemoving(null); }}
      />
    </form>
  );
}
