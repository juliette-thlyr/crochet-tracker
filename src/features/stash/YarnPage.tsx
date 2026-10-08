import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import ConfirmDialog from '../../components/ConfirmDialog';
import ErrorBox from '../../components/ErrorBox';
import NumberField from '../../components/NumberField';
import { formatEuros } from '../../lib/calc';
import { STATUS_LABELS, weightLabel } from '../../lib/labels';
import { useSignedUrl } from '../../lib/storage';
import { useAddSkeins, useDeleteYarn, useYarn, useYarnUsage } from './api';

export default function YarnPage() {
  const { id } = useParams() as { id: string };
  const navigate = useNavigate();
  const { data: yarn, isPending, error, refetch } = useYarn(id);
  const usage = useYarnUsage(id);
  const del = useDeleteYarn();
  const addSkeins = useAddSkeins();
  const [adding, setAdding] = useState<number | null | undefined>(undefined);
  const [confirming, setConfirming] = useState(false);
  const photo = useSignedUrl('yarn-photos', yarn?.photo_path ?? null);

  if (error) return <ErrorBox error={error} onRetry={() => refetch()} />;
  if (isPending) return <p className="p-4 text-muted">Loading…</p>;

  const stats = [
    { label: 'Owned', value: yarn.owned },
    { label: 'Used', value: yarn.used },
    { label: 'Reserved', value: yarn.reserved },
    { label: 'Free', value: yarn.free },
  ];

  return (
    <div className="flex flex-col">
      <div className="relative h-44 bg-stash">
        {photo && <img src={photo} alt="" className="h-full w-full object-cover" />}
        <div className="absolute inset-x-0 top-0 flex justify-between p-2">
          <Link to="/stash" className="flex min-h-11 items-center px-2 text-white">‹ Stash</Link>
          <Link to={`/stash/${id}/edit`} className="flex min-h-11 items-center px-2 text-white">Edit</Link>
        </div>
      </div>
      <div className="flex flex-col gap-3.5 p-4">
        <div>
          <h1 className="text-3xl text-stash">{yarn.name}</h1>
          <p className="text-sm text-muted">{[yarn.brand, weightLabel(yarn.yarn_weight), yarn.fiber].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {stats.map((s) => (
            <div key={s.label} className={`flex flex-col rounded-xl p-2 ${s.label === 'Free' ? 'bg-stash-soft' : 'border border-line bg-surface'}`}>
              <span className="text-xs text-muted">{s.label}</span>
              <span className="text-xl">{Number(s.value.toFixed(2))}</span>
            </div>
          ))}
        </div>
        {adding === undefined ? (
          <button type="button" onClick={() => setAdding(1)}
            className="min-h-11 self-start rounded-full bg-stash px-5 text-white">+ Add skeins</button>
        ) : (
          <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface p-3">
            <label className="flex w-32 flex-col gap-1 text-sm text-muted">How many skeins?
              <NumberField value={adding} min={0} step={0.25} onChange={setAdding}
                className="h-11 rounded-xl border border-line px-2 text-ink" />
            </label>
            <button type="button" onClick={() => setAdding(undefined)} className="h-11 px-3 text-muted">Cancel</button>
            <button type="button" disabled={!adding || adding <= 0 || addSkeins.isPending}
              onClick={() => addSkeins.mutate({ yarnId: id, amount: adding! }, { onSuccess: () => setAdding(undefined) })}
              className="h-11 rounded-full bg-stash px-4 text-white">Add</button>
          </div>
        )}
        {addSkeins.error && <ErrorBox error={addSkeins.error} />}
        {yarn.free < 0 && <p className="text-sm text-projects-dark">More used than owned: update the owned count.</p>}

        <h2 className="text-sm uppercase tracking-wide text-muted">Used in</h2>
        {(usage.data ?? []).map((u) => (
          <Link key={u.projectId} to={`/projects/${u.projectId}`}
            className="flex items-center justify-between rounded-2xl border border-line bg-surface px-3.5 py-3 text-sm">
            <span>{u.name}<br /><span className="text-muted">{STATUS_LABELS[u.status]}</span></span>
            <span>{u.used} used · {u.planned} planned</span>
          </Link>
        ))}

        <h2 className="text-sm uppercase tracking-wide text-muted">Purchase</h2>
        <dl className="rounded-2xl border border-line bg-surface text-sm">
          <div className="flex justify-between border-b border-divider px-3.5 py-3"><dt className="text-muted">Shop</dt><dd>{yarn.bought_at ?? '—'}</dd></div>
          <div className="flex justify-between border-b border-divider px-3.5 py-3"><dt className="text-muted">Price per skein</dt><dd>{formatEuros(yarn.price_per_skein)}</dd></div>
          <div className="flex justify-between px-3.5 py-3"><dt className="text-muted">Bought on</dt><dd>{yarn.bought_on ?? '—'}</dd></div>
        </dl>

        <button type="button" onClick={() => setConfirming(true)} className="h-11 self-start rounded-full border border-line px-5">
          Delete yarn
        </button>
        {del.error && <p role="alert" className="text-projects-dark">{del.error.message}</p>}
      </div>
      <ConfirmDialog
        open={confirming}
        title={`Delete ${yarn.name}?`}
        message="This cannot be undone."
        confirmLabel="Delete"
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          del.mutate(id, { onSuccess: () => navigate('/stash') });
        }}
      />
    </div>
  );
}
