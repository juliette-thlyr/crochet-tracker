import { useState } from 'react';
import { usePartInstructions } from './api';
import InstructionThumb from './InstructionThumb';
import InstructionViewer from './InstructionViewer';

export default function InstructionsSection({ patternPartId }: { patternPartId: string }) {
  const { data } = usePartInstructions(patternPartId);
  const [open, setOpen] = useState<number | null>(null);
  const items = (data ?? []).map((i) => ({
    path: i.image_path,
    label: i.kind === 'pdf_page' ? `page ${i.pdf_page}` : 'photo',
  }));
  if (items.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm uppercase tracking-wide text-muted">Instructions</h2>
      {items.map((it, i) => (
        <button key={it.path} type="button" aria-label={`Open ${it.label}`} onClick={() => setOpen(i)}
          className="overflow-hidden rounded-2xl border border-line bg-surface">
          <InstructionThumb path={it.path} alt={`Instructions ${it.label}`} className="w-full" />
        </button>
      ))}
      {open !== null && <InstructionViewer items={items} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </section>
  );
}
