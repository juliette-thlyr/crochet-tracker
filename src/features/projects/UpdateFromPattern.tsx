import { useState } from 'react';
import ConfirmDialog from '../../components/ConfirmDialog';
import ErrorBox from '../../components/ErrorBox';
import { usePattern } from '../patterns/api';
import { useApplyPatternUpdate, type ProjectDetail } from './api';
import { defaultTicks, diffProjectWithPattern, toRpcChanges, type PatternChange } from './patternDiff';

function changeLabel(c: PatternChange): string {
  switch (c.kind) {
    case 'add': return `New part: ${c.name}`;
    case 'rename': return `Rename ${c.from} → ${c.to}`;
    case 'rows': return `${c.name}: rows ${c.from ?? '—'} → ${c.to ?? '—'}`;
    case 'removed': return `${c.name} is no longer in the pattern — delete it`;
  }
}

/** Preview of what changed in the pattern; nothing is applied until "Apply". */
export default function UpdateFromPattern({ project, onClose }: { project: ProjectDetail; onClose: () => void }) {
  const pattern = usePattern(project.pattern?.id);
  const apply = useApplyPatternUpdate();
  const [ticked, setTicked] = useState<Set<string> | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (pattern.error) return <ErrorBox error={pattern.error} />;
  if (!pattern.data) return <p className="text-muted">Loading…</p>;

  const changes = diffProjectWithPattern(
    project.parts.map((p) => ({
      id: p.id, name: p.name, position: p.position, total_rows: p.total_rows, pattern_part_id: p.pattern_part_id,
      from_pattern: p.from_pattern,
      hasWork: p.done || (p.current_row ?? 0) > 0 || p.time_sessions.length > 0 || p.part_yarns.length > 0,
    })),
    pattern.data.parts,
  );
  const on = ticked ?? defaultTicks(changes);
  const deletions = changes.filter((c) => c.kind === 'removed' && on.has(c.key)).length;
  const toggle = (key: string) => {
    const next = new Set(on);
    if (next.has(key)) next.delete(key); else next.add(key);
    setTicked(next);
  };
  const run = () => apply.mutate({ projectId: project.id, changes: toRpcChanges(changes, on) }, { onSuccess: onClose });

  return (
    <section aria-label="Update from pattern" className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3">
      <h2 className="text-sm uppercase tracking-wide text-muted">Update from pattern</h2>
      {apply.error && <ErrorBox error={apply.error} />}
      {changes.length === 0 ? (
        <p className="text-muted">Nothing to update.</p>
      ) : (
        <>
          <p className="text-sm text-muted">Rows done, time and yarn used are never changed.</p>
          {changes.map((c) => (
            <label key={c.key} className="flex min-h-11 items-center gap-2">
              <input type="checkbox" checked={on.has(c.key)} onChange={() => toggle(c.key)} className="h-5 w-5 accent-projects" />
              <span>{changeLabel(c)}</span>
            </label>
          ))}
        </>
      )}
      <div className="flex gap-2">
        {changes.length > 0 && (
          <button type="button" disabled={apply.isPending || on.size === 0}
            onClick={() => (deletions > 0 ? setConfirming(true) : run())}
            className="h-11 rounded-full bg-projects px-5 text-white">Apply</button>
        )}
        <button type="button" onClick={onClose} className="h-11 rounded-full border border-line px-5">Cancel</button>
      </div>
      <ConfirmDialog
        open={confirming}
        title={`Delete ${deletions} ${deletions === 1 ? 'part' : 'parts'}?`}
        message="Their time and yarn records are deleted too."
        confirmLabel="Delete"
        onCancel={() => setConfirming(false)}
        onConfirm={() => { setConfirming(false); run(); }}
      />
    </section>
  );
}
