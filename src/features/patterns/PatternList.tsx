import { useState } from 'react';
import { Link } from 'react-router';
import ErrorBox from '../../components/ErrorBox';
import { expandPatternParts, formatDuration, formatHook, formatSkeins } from '../../lib/calc';
import { weightLabel } from '../../lib/labels';
import { usePatterns, usePatternTypes, type PatternListItem } from './api';
import { buildTypeChips } from './logic';
import TypeChips from './TypeChips';

export function patternMeta(p: PatternListItem): string {
  const n = expandPatternParts(p.parts).length;
  return [`${n} ${n === 1 ? 'part' : 'parts'}`, weightLabel(p.yarn_weight), p.hook_size_mm === null ? '' : formatHook(p.hook_size_mm)]
    .filter(Boolean).join(' · ');
}

export function patternStats(p: PatternListItem): string {
  if (p.timesMade === 0) return 'Not made yet';
  return [`Made ${p.timesMade}×`, p.avgSeconds !== null && `avg ${formatDuration(p.avgSeconds)}`,
    p.avgSkeins !== null && formatSkeins(p.avgSkeins)].filter(Boolean).join(' · ');
}

export default function PatternList() {
  const { data, isPending, error, refetch } = usePatterns();
  const types = usePatternTypes();
  const [selected, setSelected] = useState<string>('all');

  if (error) return <ErrorBox error={error} onRetry={() => refetch()} />;
  if (isPending) return <p className="p-4 text-muted">Loading…</p>;

  const chips = buildTypeChips(types.data ?? [], data.map((p) => p.pattern_type_id));
  const shown = selected === 'all' ? data : data.filter((p) => p.pattern_type_id === selected);

  return (
    <div className="flex flex-col gap-2.5 p-4">
      <header className="flex items-center justify-between pt-2">
        <h1 className="text-4xl">Patterns</h1>
        <span className="flex items-center gap-2">
          <Link to="/patterns/types" className="flex h-11 items-center px-2 text-patterns">Manage types</Link>
          <Link to="/patterns/new" className="flex h-11 items-center rounded-full bg-patterns px-5 text-white">+ Add</Link>
        </span>
      </header>
      <TypeChips chips={chips} selected={selected} onSelect={setSelected} tone="patterns" />
      {shown.map((p) => (
        <Link key={p.id} to={`/patterns/${p.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-2.5">
          <div className="h-16 w-16 shrink-0 rounded-xl bg-patterns-soft" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="flex items-center justify-between gap-2">
              <span className="text-lg">{p.name}</span>
              {p.type && <span className="rounded-lg bg-patterns-soft px-2 text-xs text-patterns-dark">{p.type.name}</span>}
            </span>
            <span className="text-sm text-muted">{patternMeta(p)}</span>
            <span className="text-sm text-stash">{patternStats(p)}</span>
          </div>
        </Link>
      ))}
      {data.length === 0 && <p className="text-muted">No patterns yet. Add your first one.</p>}
    </div>
  );
}
