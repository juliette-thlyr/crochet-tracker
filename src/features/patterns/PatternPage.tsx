import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import ConfirmDialog from '../../components/ConfirmDialog';
import ErrorBox from '../../components/ErrorBox';
import { expandPatternParts, formatDuration, formatHook } from '../../lib/calc';
import { weightLabel } from '../../lib/labels';
import { useSignedUrl } from '../../lib/storage';
import { useDeletePattern, usePattern, usePatternInstructionCounts, useStartProject } from './api';
import PatternThumb from './PatternThumb';

export default function PatternPage() {
  const { id } = useParams() as { id: string };
  const navigate = useNavigate();
  const { data: p, isPending, error, refetch } = usePattern(id);
  const counts = usePatternInstructionCounts(id);
  const start = useStartProject();
  const del = useDeletePattern();
  const [confirming, setConfirming] = useState(false);
  const pdfUrl = useSignedUrl('pattern-pdfs', p?.pdf_path ?? null);

  if (error) return <ErrorBox error={error} onRetry={() => refetch()} />;
  if (isPending) return <p className="p-4 text-muted">Loading…</p>;

  const meta = [p.designer && `by ${p.designer}`, weightLabel(p.yarn_weight),
    p.hook_size_mm !== null && `recommended hook ${formatHook(Number(p.hook_size_mm))}`].filter(Boolean).join(' · ');

  return (
    <div className="flex flex-col gap-3 p-4">
      <header className="flex items-center justify-between">
        <Link to="/patterns" className="flex min-h-11 items-center text-patterns">‹ Patterns</Link>
        <Link to={`/patterns/${id}/edit`} className="flex min-h-11 items-center text-patterns">Edit</Link>
      </header>
      <PatternThumb path={p.photo_path} className="h-48 w-full rounded-3xl" />
      <h1 className="text-4xl text-patterns">{p.name}</h1>
      {p.type && <span className="self-start rounded-lg bg-patterns-soft px-2.5 py-0.5 text-sm text-patterns-dark">{p.type.name}</span>}
      {meta && <p className="text-sm text-muted">{meta}</p>}

      <div className="grid grid-cols-3 gap-2">
        {[
          ['Made', `${p.timesMade}×`],
          ['Avg time', p.avgSeconds === null ? '—' : formatDuration(p.avgSeconds)],
          ['Avg yarn', p.avgSkeins === null ? '—' : `${p.avgSkeins} sk`],
        ].map(([k, v]) => (
          <div key={k} className="flex flex-col rounded-2xl bg-stash-soft p-3">
            <span className="text-xs text-stash-dark">{k}</span>
            <span className="text-xl">{v}</span>
          </div>
        ))}
      </div>

      {pdfUrl && (
        <a href={pdfUrl} target="_blank" rel="noreferrer"
          className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3">
          <span className="flex h-12 w-10 items-center justify-center rounded-md bg-patterns-soft text-xs text-patterns">PDF</span>
          <span className="flex-1">Open pattern</span>
          <span className="text-patterns">›</span>
        </a>
      )}

      <h2 className="text-sm uppercase tracking-wide text-muted">Parts · {expandPatternParts(p.parts).length} when started</h2>
      <ul className="rounded-2xl border border-line bg-surface">
        {p.parts.map((part) => (
          <li key={part.id} className="flex items-center justify-between gap-2 border-b border-divider px-3.5 py-2.5 last:border-b-0">
            <span>{part.name} {part.count > 1 && <span className="text-patterns">×{part.count}</span>}</span>
            <span className="flex-1 text-muted">{part.total_rows === null ? '—' : `${part.total_rows} rows`}</span>
            <Link to={`/patterns/${id}/parts/${part.id}`} className="flex min-h-11 items-center text-sm text-patterns">
              Instructions · {counts.data?.get(part.id) ?? 0}
            </Link>
          </li>
        ))}
      </ul>

      {start.error && <ErrorBox error={start.error} />}
      {del.error && <ErrorBox error={del.error} />}
      <button type="button" disabled={start.isPending}
        onClick={() => start.mutate(id, { onSuccess: (projectId) => navigate(`/projects/${projectId}`) })}
        className="h-14 rounded-full bg-patterns text-lg text-white">
        Start a project from this pattern
      </button>
      <button type="button" onClick={() => setConfirming(true)} className="h-11 self-start rounded-full border border-line px-5">
        Delete pattern
      </button>
      <ConfirmDialog
        open={confirming}
        title={`Delete ${p.name}?`}
        message="Projects made from it are kept."
        confirmLabel="Delete"
        onCancel={() => setConfirming(false)}
        onConfirm={() => { setConfirming(false); del.mutate(id, { onSuccess: () => navigate('/patterns') }); }}
      />
    </div>
  );
}
