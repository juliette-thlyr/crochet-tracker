import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import ConfirmDialog from '../../components/ConfirmDialog';
import ErrorBox from '../../components/ErrorBox';
import {
  useCreatePatternType, useDeletePatternType, useMovePatternType, usePatternTypes, useRenamePatternType, type PatternType,
} from './api';
import { nextTypePosition } from './logic';

export default function TypesPage() {
  const { data: types, isPending, error, refetch } = usePatternTypes();
  const create = useCreatePatternType();
  const rename = useRenamePatternType();
  const move = useMovePatternType();
  const del = useDeletePatternType();
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [newType, setNewType] = useState('');
  const [confirm, setConfirm] = useState<PatternType | null>(null);

  if (error) return <ErrorBox error={error} onRetry={() => refetch()} />;
  if (isPending) return <p className="p-4 text-muted">Loading…</p>;

  const mutationError = create.error ?? rename.error ?? move.error ?? del.error;

  function saveName(t: PatternType) {
    const name = renaming?.name.trim() ?? '';
    if (name && name !== t.name) rename.mutate({ id: t.id, name });
    setRenaming(null);
  }

  function add(e: FormEvent) {
    e.preventDefault();
    const name = newType.trim();
    if (!name) return;
    create.mutate({ name, position: nextTypePosition(types ?? []) }, { onSuccess: () => setNewType('') });
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <Link to="/patterns" className="flex min-h-11 items-center self-start text-patterns">‹ Patterns</Link>
      <h1 className="text-4xl text-patterns">Pattern types</h1>
      {mutationError && <ErrorBox error={mutationError} />}
      <ul className="rounded-2xl border border-line bg-surface">
        {types.map((t, i) => (
          <li key={t.id} className="flex items-center gap-1 border-b border-divider py-1 pl-3.5 pr-1 last:border-b-0">
            {renaming?.id === t.id ? (
              <input autoFocus aria-label="Type name" value={renaming.name}
                onChange={(e) => setRenaming({ id: t.id, name: e.target.value })} onBlur={() => saveName(t)}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-bg px-3" />
            ) : (
              <button type="button" aria-label={`Rename ${t.name}`} onClick={() => setRenaming({ id: t.id, name: t.name })}
                className="min-h-11 flex-1 text-left">{t.name}</button>
            )}
            <button type="button" aria-label={`Move ${t.name} up`} disabled={i === 0}
              onClick={() => move.mutate({ a: t, b: types[i - 1] })} className="h-11 w-11 disabled:text-muted">↑</button>
            <button type="button" aria-label={`Move ${t.name} down`} disabled={i === types.length - 1}
              onClick={() => move.mutate({ a: t, b: types[i + 1] })} className="h-11 w-11 disabled:text-muted">↓</button>
            <button type="button" aria-label={`Delete ${t.name}`} onClick={() => setConfirm(t)}
              className="h-11 w-11 text-patterns">×</button>
          </li>
        ))}
        {types.length === 0 && <li className="px-3.5 py-3 text-muted">No types yet.</li>}
      </ul>
      <form onSubmit={add} className="flex gap-2">
        <input aria-label="New type name" placeholder="New type" value={newType} onChange={(e) => setNewType(e.target.value)}
          className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3" />
        <button type="submit" className="h-11 rounded-full bg-patterns px-5 text-white">+ Add type</button>
      </form>
      <ConfirmDialog
        open={confirm !== null}
        title={`Delete ${confirm?.name}?`}
        message="Patterns of this type become untyped."
        confirmLabel="Delete"
        onCancel={() => setConfirm(null)}
        onConfirm={() => { if (confirm) del.mutate(confirm.id); setConfirm(null); }}
      />
    </div>
  );
}
