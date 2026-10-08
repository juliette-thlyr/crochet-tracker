import { useState } from 'react';
import { Link } from 'react-router';
import ErrorBox from '../../components/ErrorBox';
import { formatSkeins, stockBadge } from '../../lib/calc';
import { WEIGHTS, weightLabel, type YarnWeight } from '../../lib/labels';
import { useSignedUrl } from '../../lib/storage';
import { useYarns } from './api';
import { filterYarns, type YarnWithStock } from './logic';
import PageTitle from '../../components/PageTitle';

const chip = (on: boolean) =>
  `h-11 shrink-0 rounded-full px-3.5 text-sm ${on ? 'bg-stash text-white' : 'border border-line bg-surface'}`;

export default function StashList() {
  const { data, isPending, error, refetch } = useYarns();
  const [weight, setWeight] = useState<YarnWeight | 'all'>('all');
  const [fiber, setFiber] = useState<string>('all');
  const [lowOnly, setLowOnly] = useState(false);

  if (error) return <ErrorBox error={error} onRetry={() => refetch()} />;
  if (isPending) return <p className="p-4 text-muted">Loading…</p>;

  const weights = WEIGHTS.filter((w) => data.some((y) => y.yarn_weight === w.value));
  const fibers = [...new Set(data.map((y) => y.fiber).filter((f): f is string => !!f))].sort();
  const shown = filterYarns(data, { weight, fiber, lowOnly });

  return (
    <div className="flex flex-col gap-3 p-4">
      <header className="flex items-center justify-between pt-2">
        <PageTitle color="text-stash">Stash</PageTitle>
        <Link to="/stash/new" className="flex h-11 items-center rounded-full bg-stash px-5 text-white">+ Yarn</Link>
      </header>
      <div className="flex gap-2 overflow-x-auto">
        <button type="button" className={chip(weight === 'all')} onClick={() => setWeight('all')}>All weights</button>
        {weights.map((w) => (
          <button key={w.value} type="button" className={chip(weight === w.value)} onClick={() => setWeight(w.value)}>
            {w.label}
          </button>
        ))}
        <button type="button" className={chip(lowOnly)} aria-pressed={lowOnly} onClick={() => setLowOnly(!lowOnly)}>
          Low
        </button>
      </div>
      {fibers.length > 1 && (
        <label className="flex items-center gap-2 text-sm text-muted">
          Fiber
          <select value={fiber} onChange={(e) => setFiber(e.target.value)}
            className="h-11 rounded-xl border border-line bg-surface px-2 text-ink">
            <option value="all">All fibers</option>
            {fibers.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
      )}
      {shown.length === 0 ? (
        <p className="text-muted">No yarn here yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          {shown.map((y) => <YarnCard key={y.id} yarn={y} />)}
        </div>
      )}
    </div>
  );
}

function YarnCard({ yarn }: { yarn: YarnWithStock }) {
  const photo = useSignedUrl('yarn-photos', yarn.photo_path);
  const badge = stockBadge(yarn.free);
  return (
    <Link to={`/stash/${yarn.id}`} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="relative h-20 bg-stash-soft">
        {photo && <img src={photo} alt="" className="h-full w-full object-cover" />}
        {badge && (
          <span className={`absolute right-2 top-2 rounded-lg px-2 py-0.5 text-xs ${badge === 'low' ? 'bg-sun text-ink' : 'bg-ink text-white'}`}>
            {badge === 'low' ? 'Low' : 'Out'}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-0.5 px-3 py-2.5">
        <span className="text-base">{yarn.name}</span>
        <span className="text-xs text-muted">{[yarn.brand, weightLabel(yarn.yarn_weight)].filter(Boolean).join(' · ')}</span>
        <span className="mt-1 text-sm">{formatSkeins(yarn.free)} free <span className="text-muted">/ {formatSkeins(yarn.owned)}</span></span>
      </div>
    </Link>
  );
}
