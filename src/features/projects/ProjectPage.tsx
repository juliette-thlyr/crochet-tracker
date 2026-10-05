import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import ConfirmDialog from '../../components/ConfirmDialog';
import ErrorBox from '../../components/ErrorBox';
import { formatDuration, formatHook, formatSkeins, hookLabel, hookSizeOptions, rowLabel, sumSeconds } from '../../lib/calc';
import { STATUS_LABELS, type ProjectStatus } from '../../lib/labels';
import { useSignedUrl } from '../../lib/storage';
import { useYarns } from '../stash/api';
import {
  useAddPart, useAddProjectPhoto, useDeletePart, useDeleteProject, useMovePart, usePlanYarn, useProject,
  useUpdatePart, useUpdateProject, type ProjectPart,
} from './api';
import { projectYarnLines, STATUS_ORDER } from './logic';

const h2 = 'text-sm uppercase tracking-wide text-muted';

export default function ProjectPage() {
  const { id } = useParams() as { id: string };
  const navigate = useNavigate();
  const { data: p, isPending, error, refetch } = useProject(id);
  const updateProject = useUpdateProject();
  const updatePart = useUpdatePart();
  const addPart = useAddPart();
  const deletePart = useDeletePart();
  const movePart = useMovePart();
  const planYarn = usePlanYarn();
  const addPhoto = useAddProjectPhoto();
  const deleteProject = useDeleteProject();
  const yarns = useYarns();
  const [editing, setEditing] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newPart, setNewPart] = useState<string | null>(null);
  const [plan, setPlan] = useState<{ yarnId: string; skeins: number } | null>(null);
  const [confirm, setConfirm] = useState<null | { kind: 'project' } | { kind: 'part'; part: ProjectPart }>(null);
  const cover = useSignedUrl('project-photos', p?.project_photos[0]?.path ?? null);

  if (error) return <ErrorBox error={error} onRetry={() => refetch()} />;
  if (isPending) return <p className="p-4 text-muted">Loading…</p>;

  const mutationError =
    updateProject.error ?? updatePart.error ?? addPart.error ?? deletePart.error ??
    movePart.error ?? planYarn.error ?? addPhoto.error ?? deleteProject.error;
  const now = new Date();
  const total = p.parts.reduce((s, part) => s + sumSeconds(part.time_sessions, now), 0);
  const lines = projectYarnLines(p.parts, p.project_yarns);
  const skeins = lines.reduce((s, l) => s + l.used, 0);
  const done = p.parts.filter((x) => x.done).length;
  const save = (patch: Parameters<typeof updateProject.mutate>[0]['patch']) => updateProject.mutate({ id, patch });

  return (
    <div className="flex flex-col gap-2.5 p-4">
      <Link to="/" className="flex min-h-11 items-center self-start text-projects">‹ Projects</Link>
      {mutationError && <ErrorBox error={mutationError} />}
      <div className="flex items-center gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-projects-soft">
          {cover && <img src={cover} alt="" className="h-full w-full object-cover" />}
        </div>
        <div className="flex flex-col gap-1">
          {renaming ? (
            <input autoFocus aria-label="Project name" defaultValue={p.name}
              className="h-11 rounded-xl border border-line bg-surface px-3 text-2xl"
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== p.name) updateProject.mutate({ id, patch: { name: v } });
                setRenaming(false);
              }} />
          ) : (
            <button type="button" onClick={() => setRenaming(true)} className="min-h-11 self-start text-left">
              <h1 className="text-3xl">{p.name}</h1>
            </button>
          )}
          <span className="text-sm text-muted">
            {p.pattern ? <>From <Link to={`/patterns/${p.pattern.id}`} className="text-projects">{p.pattern.name}</Link></> : 'No pattern'}
            {p.start_date && ` · since ${p.start_date}`}
            {p.finish_date && ` · finished ${p.finish_date}`}
          </span>
          <label className="relative flex min-h-11 items-center self-start rounded-xl border border-line bg-surface px-2.5 py-0.5 text-sm">
            <span>{hookLabel(p.hook_size_mm === null ? null : Number(p.hook_size_mm),
              p.pattern?.hook_size_mm == null ? null : Number(p.pattern.hook_size_mm))} ▾</span>
            <select aria-label="Hook used" className="absolute inset-0 opacity-0"
              value={p.hook_size_mm === null ? '' : String(Number(p.hook_size_mm))}
              onChange={(e) => save({ hook_size_mm: e.target.value === '' ? null : Number(e.target.value) })}>
              <option value="">—</option>
              {hookSizeOptions().map((mm) => <option key={mm} value={String(mm)}>{formatHook(mm)}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <label className="relative flex min-h-11 items-center rounded-full bg-stash-soft px-3 py-1 text-sm text-stash-dark">
          <span>{STATUS_LABELS[p.status]} ▾</span>
          <select aria-label="Status" className="absolute inset-0 opacity-0" value={p.status}
            onChange={(e) => save({ status: e.target.value as ProjectStatus })}>
            {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </label>
        <span className="rounded-full border border-line bg-surface px-3 py-1 text-sm">{formatDuration(total)} total</span>
        <span className="rounded-full border border-line bg-surface px-3 py-1 text-sm">{formatSkeins(skeins)}</span>
      </div>

      <div className="flex items-baseline justify-between">
        <h2 className={h2}>Parts · {done} of {p.parts.length} done</h2>
        <span className="flex gap-3">
          <button type="button" onClick={() => setEditing(!editing)} className="min-h-11 text-projects">{editing ? 'Done' : 'Edit'}</button>
          <button type="button" onClick={() => setNewPart('')} className="min-h-11 text-projects">+ Add part</button>
        </span>
      </div>
      <ul className="overflow-hidden rounded-2xl border border-line bg-surface">
        {p.parts.map((part, i) => (
          <li key={part.id} className="flex items-center gap-2 border-b border-divider py-1 pl-1 pr-2 last:border-b-0">
            <label className="flex h-11 w-11 items-center justify-center">
              <input type="checkbox" aria-label={`${part.name} done`} checked={part.done}
                onChange={(e) => updatePart.mutate({ id: part.id, patch: { done: e.target.checked } })}
                className="h-5 w-5 accent-stash" />
            </label>
            <Link to={`/parts/${part.id}`} className="flex min-h-11 flex-1 flex-col justify-center">
              <span>{part.name}</span>
              <span className="text-xs text-muted">
                {part.resume_note ?? (part.time_sessions.length ? formatDuration(sumSeconds(part.time_sessions, now)) : 'not started')}
              </span>
            </Link>
            <span className={`text-sm ${part.done ? 'text-stash' : ''}`}>{rowLabel(part.current_row, part.total_rows)}</span>
            {editing && (
              <span className="flex">
                <button type="button" aria-label={`Move ${part.name} up`} disabled={i === 0}
                  onClick={() => movePart.mutate({ a: part, b: p.parts[i - 1] })} className="h-11 w-11">↑</button>
                <button type="button" aria-label={`Move ${part.name} down`} disabled={i === p.parts.length - 1}
                  onClick={() => movePart.mutate({ a: part, b: p.parts[i + 1] })} className="h-11 w-11">↓</button>
                <button type="button" aria-label={`Delete ${part.name}`}
                  onClick={() => setConfirm({ kind: 'part', part })} className="h-11 w-11 text-projects">×</button>
              </span>
            )}
          </li>
        ))}
        {newPart !== null && (
          <li className="flex gap-2 p-2">
            <input autoFocus aria-label="New part name" value={newPart} onChange={(e) => setNewPart(e.target.value)}
              className="h-11 flex-1 rounded-xl border border-line px-3" />
            <button type="button" className="h-11 rounded-full bg-projects px-4 text-white"
              onClick={() => {
                if (newPart.trim()) addPart.mutate({ projectId: id, name: newPart, position: p.parts.reduce((m, x) => Math.max(m, x.position), -1) + 1 });
                setNewPart(null);
              }}>Add</button>
          </li>
        )}
      </ul>

      <div className="flex items-baseline justify-between">
        <h2 className={h2}>Yarn · used / planned</h2>
        <button type="button" onClick={() => setPlan({ yarnId: '', skeins: 1 })} className="min-h-11 text-projects">Plan yarn</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {lines.map((l) => (
          <Link key={l.yarnId} to={`/stash/${l.yarnId}`} className="rounded-xl border border-line bg-surface p-2.5 text-sm">
            {l.name}<br />{l.used} / {l.planned ?? '—'}
          </Link>
        ))}
      </div>
      {plan && (
        <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface p-3">
          <label className="flex flex-1 flex-col gap-1 text-sm text-muted">Yarn
            <select value={plan.yarnId} onChange={(e) => setPlan({ ...plan, yarnId: e.target.value })}
              className="h-11 rounded-xl border border-line px-2 text-ink">
              <option value="">Choose…</option>
              {(yarns.data ?? []).map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </label>
          <label className="flex w-24 flex-col gap-1 text-sm text-muted">Skeins
            <input type="number" min={0} step={0.25} value={plan.skeins}
              onChange={(e) => setPlan({ ...plan, skeins: Number(e.target.value) })}
              className="h-11 rounded-xl border border-line px-2 text-ink" />
          </label>
          <button type="button" disabled={!plan.yarnId} className="h-11 rounded-full bg-projects px-4 text-white"
            onClick={() => { planYarn.mutate({ projectId: id, yarnId: plan.yarnId, skeins: plan.skeins }); setPlan(null); }}>
            Save
          </button>
        </div>
      )}

      <h2 className={h2}>Photos</h2>
      <div className="grid grid-cols-3 gap-2">
        {p.project_photos.map((ph) => <Photo key={ph.id} path={ph.path} />)}
        <label className="flex h-24 cursor-pointer items-center justify-center rounded-xl border-[1.5px] border-dashed border-muted text-sm">
          {addPhoto.isPending ? 'Uploading…' : '+ Photo'}
          <input type="file" accept="image/*" className="sr-only"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) addPhoto.mutate({ projectId: id, file: f }); }} />
        </label>
      </div>

      <h2 className={h2}>Notes</h2>
      <textarea aria-label="Project notes" rows={3} defaultValue={p.notes ?? ''}
        onBlur={(e) => { if (e.target.value !== (p.notes ?? '')) save({ notes: e.target.value || null }); }}
        className="rounded-xl border border-line bg-surface p-3" />

      <button type="button" onClick={() => setConfirm({ kind: 'project' })} className="h-11 self-start rounded-full border border-line px-5">
        Delete project
      </button>
      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.kind === 'part' ? `Delete ${confirm.part.name}?` : `Delete ${p.name}?`}
        message={confirm?.kind === 'part' ? 'Its time and yarn records are deleted too.' : 'All its parts, time and photos are deleted.'}
        confirmLabel="Delete"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm?.kind === 'part') deletePart.mutate(confirm.part.id);
          else deleteProject.mutate(id, { onSuccess: () => navigate('/') });
          setConfirm(null);
        }}
      />
    </div>
  );
}

function Photo({ path }: { path: string }) {
  const url = useSignedUrl('project-photos', path);
  return <div className="h-24 overflow-hidden rounded-xl bg-projects-soft">{url && <img src={url} alt="" className="h-full w-full object-cover" />}</div>;
}
