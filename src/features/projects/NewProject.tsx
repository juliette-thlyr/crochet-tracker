import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import ErrorBox from '../../components/ErrorBox';
import { expandPatternParts } from '../../lib/calc';
import { usePatterns, usePatternTypes, useStartProject } from '../patterns/api';
import { buildTypeChips } from '../patterns/logic';
import TypeChips from '../patterns/TypeChips';
import { useCreateBlankProject } from './api';

export default function NewProject() {
  const navigate = useNavigate();
  const patterns = usePatterns();
  const types = usePatternTypes();
  const start = useStartProject();
  const blank = useCreateBlankProject();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const open = { onSuccess: (id: string) => navigate(`/projects/${id}`) };

  if (patterns.error) return <ErrorBox error={patterns.error} />;
  const all = patterns.data ?? [];
  const shown = all.filter(
    (p) => (type === 'all' || p.pattern_type_id === type) && p.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <div className="flex flex-col gap-3 p-4">
      <Link to="/" className="flex min-h-11 items-center self-start text-projects">‹ Cancel</Link>
      <h1 className="text-4xl">New project</h1>
      <p className="text-muted">Pick a pattern: its parts are copied in.</p>
      <input type="search" aria-label="Search patterns" placeholder="Search patterns" value={search}
        onChange={(e) => setSearch(e.target.value)} className="h-12 rounded-full border border-line bg-surface px-4" />
      <TypeChips chips={buildTypeChips(types.data ?? [], all.map((p) => p.pattern_type_id))}
        selected={type} onSelect={setType} tone="projects" />
      {(start.error || blank.error) && <ErrorBox error={start.error ?? blank.error} />}
      <div className="grid grid-cols-2 gap-2.5">
        {shown.map((p) => (
          <button key={p.id} type="button" disabled={start.isPending} onClick={() => start.mutate(p.id, open)}
            className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-2.5 text-left">
            <div className="h-24 rounded-xl bg-patterns-soft" />
            <span className="text-base">{p.name}</span>
            <span className="text-xs text-muted">
              {[p.type?.name, `${expandPatternParts(p.parts).length} parts`].filter(Boolean).join(' · ')}
            </span>
          </button>
        ))}
      </div>
      <button type="button" disabled={blank.isPending} onClick={() => blank.mutate(undefined, open)}
        className="min-h-13 rounded-full border-[1.5px] border-dashed border-muted py-3">
        Start a blank project
      </button>
    </div>
  );
}
