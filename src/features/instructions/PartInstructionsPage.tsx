import { useState } from 'react';
import { Link, useParams } from 'react-router';
import ConfirmDialog from '../../components/ConfirmDialog';
import ErrorBox from '../../components/ErrorBox';
import { usePattern } from '../patterns/api';
import {
  nextInstructionPosition, useAddInstructionPhotos, useAddPdfPages, usePartInstructions, useRemoveInstruction,
  type Instruction,
} from './api';
import InstructionThumb from './InstructionThumb';
import { parsePageRanges } from './pageRanges';

const label = (i: Instruction) => (i.kind === 'pdf_page' ? `page ${i.pdf_page}` : 'photo');

export default function PartInstructionsPage() {
  const { id, partId } = useParams() as { id: string; partId: string };
  const pattern = usePattern(id);
  const list = usePartInstructions(partId);
  const addPages = useAddPdfPages();
  const addPhotos = useAddInstructionPhotos();
  const remove = useRemoveInstruction();
  const [pages, setPages] = useState('');
  const [pageError, setPageError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Instruction | null>(null);

  if (pattern.error) return <ErrorBox error={pattern.error} onRetry={() => pattern.refetch()} />;
  if (pattern.isPending || !pattern.data) return <p className="p-4 text-muted">Loading…</p>;
  const p = pattern.data;
  const part = p.parts.find((x) => x.id === partId);
  if (!part) return <ErrorBox error={new Error('This part no longer exists.')} />;

  const items = list.data ?? [];
  const start = nextInstructionPosition(items);
  const busy = addPages.isPending || addPhotos.isPending;
  const pdfReplaced = p.pdf_updated_at !== null && items.some(
    (i) => i.kind === 'pdf_page' && new Date(i.created_at).getTime() < new Date(p.pdf_updated_at!).getTime(),
  );
  const error = list.error ?? addPages.error ?? addPhotos.error ?? remove.error;

  function submitPages() {
    const parsed = parsePageRanges(pages);
    if ('error' in parsed) { setPageError(parsed.error); return; }
    setPageError(null);
    addPages.mutate(
      { patternPartId: partId, pdfPath: p.pdf_path!, pages: parsed.pages, startPosition: start },
      { onSuccess: () => setPages('') },
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <Link to={`/patterns/${id}`} className="flex min-h-11 items-center self-start text-patterns">‹ {p.name}</Link>
      <h1 className="text-3xl">{p.name} · {part.name}</h1>
      {error && <ErrorBox error={error} />}
      {pdfReplaced && <p className="rounded-xl bg-sun-track p-3 text-sm">The PDF was replaced — re-add pages if they changed.</p>}

      <section className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3">
        <label className="flex flex-col gap-1 text-sm text-muted">PDF pages
          <input value={pages} onChange={(e) => setPages(e.target.value)} placeholder="3-4 or 3, 5"
            disabled={!p.pdf_path} className="h-11 rounded-xl border border-line px-3 text-ink" />
        </label>
        {!p.pdf_path && <p className="text-sm text-muted">Attach a PDF to the pattern first.</p>}
        {pageError && <p role="alert" className="text-projects-dark">{pageError}</p>}
        <button type="button" onClick={submitPages} disabled={!p.pdf_path || busy}
          className="h-11 self-start rounded-full bg-patterns px-5 text-white">Add pages</button>
      </section>

      <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-dashed border-muted bg-surface px-4 text-sm">
        {busy ? 'Adding…' : 'Add photos'}
        <input type="file" accept="image/*" multiple className="sr-only" aria-label="Add photos"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            if (files.length > 0) addPhotos.mutate({ patternPartId: partId, files, startPosition: start });
          }} />
      </label>

      <ul className="grid grid-cols-3 gap-2">
        {items.map((i) => (
          <li key={i.id} className="relative flex flex-col gap-1">
            <InstructionThumb path={i.image_path} alt={`Instructions ${label(i)}`} className="h-28 rounded-xl" />
            <span className="text-xs text-muted">{label(i)}</span>
            <button type="button" aria-label={`Remove ${label(i)}`} onClick={() => setRemoving(i)}
              className="absolute right-0 top-0 h-11 w-11 rounded-full bg-surface/80 text-muted">×</button>
          </li>
        ))}
      </ul>
      {items.length === 0 && <p className="text-muted">No instructions yet.</p>}

      <ConfirmDialog
        open={removing !== null}
        title={`Remove this ${removing ? label(removing) : ''}?`}
        message="It disappears from this part's instructions."
        confirmLabel="Remove"
        onCancel={() => setRemoving(null)}
        onConfirm={() => { if (removing) remove.mutate(removing); setRemoving(null); }}
      />
    </div>
  );
}
