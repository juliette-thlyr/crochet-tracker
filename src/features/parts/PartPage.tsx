import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import ConfirmDialog from '../../components/ConfirmDialog';
import ErrorBox from '../../components/ErrorBox';
import { formatDuration, formatSkeins, sessionSeconds, sumSeconds } from '../../lib/calc';
import { useDeletePart, useUpdatePart } from '../projects/api';
import { useYarns } from '../stash/api';
import { useSetRow } from '../timer/api';
import { useDeleteSession, usePart, useRemoveYarnUsage, useSaveSession, useSetYarnUsage, type Session } from './api';
import RowCounter from './RowCounter';
import SessionForm from './SessionForm';
import YarnUsageForm from './YarnUsageForm';

const h2 = 'text-sm uppercase tracking-wide text-muted';
const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function PartPage() {
  const { id } = useParams() as { id: string };
  const navigate = useNavigate();
  const { data: part, isPending, error, refetch } = usePart(id);
  const updatePart = useUpdatePart();
  const setRow = useSetRow();
  const deletePart = useDeletePart();
  const saveSession = useSaveSession();
  const deleteSession = useDeleteSession();
  const setYarn = useSetYarnUsage();
  const removeYarn = useRemoveYarnUsage();
  const yarns = useYarns();
  const [sessionForm, setSessionForm] = useState<null | 'new' | Session>(null);
  const [addingYarn, setAddingYarn] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (error) return <ErrorBox error={error} onRetry={() => refetch()} />;
  if (isPending) return <p className="p-4 text-muted">Loading…</p>;

  const mutationError =
    updatePart.error ?? setRow.error ?? deletePart.error ?? saveSession.error ?? deleteSession.error ?? setYarn.error ?? removeYarn.error;
  const now = new Date();
  const patch = (p: Parameters<typeof updatePart.mutate>[0]['patch']) => updatePart.mutate({ id, patch: p });

  return (
    <div className="flex flex-col gap-3 p-4">
      <Link to={`/projects/${part.project.id}`} className="flex min-h-11 items-center self-start text-projects">‹ {part.project.name}</Link>
      {mutationError && <ErrorBox error={mutationError} />}
      <div className="flex items-center justify-between">
        {renaming === null ? (
          <button type="button" onClick={() => setRenaming(part.name)} className="min-h-11 text-left">
            <h1 className="text-4xl">{part.name}</h1>
          </button>
        ) : (
          <input autoFocus aria-label="Part name" value={renaming} onChange={(e) => setRenaming(e.target.value)}
            onBlur={() => {
              const name = renaming.trim();
              if (name && name !== part.name) patch({ name });
              setRenaming(null);
            }}
            className="h-12 flex-1 rounded-xl border border-line px-3 text-2xl" />
        )}
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" checked={part.done} onChange={(e) => patch({ done: e.target.checked })} className="h-5 w-5 accent-stash" />
          Done
        </label>
      </div>

      <section className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-4">
        <RowCounter current={part.current_row} total={part.total_rows} onChange={(r) => setRow.mutate({ partId: id, row: r })} />
        <label className="flex flex-col gap-1.5 text-sm text-muted">Where I stopped
          <textarea rows={2} defaultValue={part.resume_note ?? ''}
            onBlur={(e) => { if (e.target.value !== (part.resume_note ?? '')) patch({ resume_note: e.target.value || null }); }}
            className="resize-none rounded-xl border border-line bg-bg p-2.5 text-base text-ink" />
        </label>
      </section>

      <div className="flex items-center justify-between">
        <h2 className={h2}>Time · {formatDuration(sumSeconds(part.time_sessions, now))}</h2>
        <button type="button" onClick={() => setSessionForm('new')} className="min-h-11 text-projects">+ Add time manually</button>
      </div>
      {sessionForm && (
        <SessionForm
          key={sessionForm === 'new' ? 'new' : sessionForm.id}
          initial={sessionForm === 'new' ? undefined : { started_at: sessionForm.started_at, minutes: Math.round(sessionSeconds(sessionForm, now) / 60) }}
          onCancel={() => setSessionForm(null)}
          onSave={(s) => {
            saveSession.mutate({ ...s, part_id: id, id: sessionForm === 'new' ? undefined : sessionForm.id });
            setSessionForm(null);
          }}
        />
      )}
      <ul className="rounded-2xl border border-line bg-surface">
        {part.time_sessions.map((s) => (
          <li key={s.id} className="flex items-center justify-between border-b border-divider px-3.5 py-2 last:border-b-0">
            <span>{when(s.started_at)}</span>
            {s.ended_at === null ? (
              <span className="text-projects">running · {formatDuration(sessionSeconds(s, now))}</span>
            ) : (
              <span className="flex items-center gap-1">
                {formatDuration(sessionSeconds(s, now))}
                <button type="button" aria-label="Edit time" onClick={() => setSessionForm(s)} className="h-11 w-11 text-muted">✎</button>
                <button type="button" aria-label="Delete time" onClick={() => deleteSession.mutate(s.id)} className="h-11 w-11 text-muted">×</button>
              </span>
            )}
          </li>
        ))}
        {part.time_sessions.length === 0 && <li className="px-3.5 py-3 text-muted">No time yet.</li>}
      </ul>

      <div className="flex items-center justify-between">
        <h2 className={h2}>Yarn used</h2>
        <button type="button" onClick={() => setAddingYarn(true)} className="min-h-11 text-projects">+ Add yarn</button>
      </div>
      {addingYarn && (
        <YarnUsageForm
          yarns={yarns.data ?? []}
          onCancel={() => setAddingYarn(false)}
          onSave={({ yarnId, skeins }) => { setYarn.mutate({ partId: id, yarnId, skeins }); setAddingYarn(false); }}
        />
      )}
      {part.part_yarns.map((u) => (
        <div key={u.id} className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface px-3.5 py-2">
          <span className="flex-1">{u.yarn?.name}{u.yarn?.brand && ` · ${u.yarn.brand}`}</span>
          <span>{formatSkeins(Number(u.skeins_used))}</span>
          <button type="button" aria-label={`Remove ${u.yarn?.name}`} onClick={() => removeYarn.mutate(u.id)} className="h-11 w-11 text-muted">×</button>
        </div>
      ))}

      <button type="button" onClick={() => setConfirming(true)} className="h-11 self-start rounded-full border border-line px-5">Delete part</button>
      <ConfirmDialog
        open={confirming}
        title={`Delete ${part.name}?`}
        message="Its time and yarn records are deleted too."
        confirmLabel="Delete"
        onCancel={() => setConfirming(false)}
        onConfirm={() => { setConfirming(false); deletePart.mutate(id, { onSuccess: () => navigate(`/projects/${part.project.id}`) }); }}
      />
    </div>
  );
}
