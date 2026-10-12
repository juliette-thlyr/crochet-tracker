import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import ErrorBox from '../../components/ErrorBox';
import { colourHex } from '../../lib/colours';
import { skeinsText } from '../materials/logic';
import { usePattern, useStartProject } from '../patterns/api';
import { useYarns } from '../stash/api';
import type { YarnWithStock } from '../stash/logic';
import YarnPicker from './YarnPicker';

export default function StartProjectPage() {
  const { id } = useParams() as { id: string };
  const navigate = useNavigate();
  const pattern = usePattern(id);
  const yarns = useYarns();
  const start = useStartProject();
  const [picks, setPicks] = useState<Record<string, YarnWithStock>>({});
  const [open, setOpen] = useState<string | null>(null);

  if (pattern.error) return <ErrorBox error={pattern.error} />;
  if (!pattern.data) return <p className="p-4 text-muted">Loading…</p>;
  const p = pattern.data;

  function startProject() {
    const plans = p.yarn_lines
      .filter((l) => picks[l.id])
      .map((l) => ({ yarn_id: picks[l.id].id, skeins: Number(l.skeins ?? 0) }));
    start.mutate({ patternId: id, plans }, { onSuccess: (projectId) => navigate(`/projects/${projectId}`) });
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <Link to={`/patterns/${id}`} className="flex min-h-11 items-center self-start text-projects">‹ {p.name}</Link>
      <h1 className="text-4xl text-projects">Start {p.name}</h1>
      <p className="text-muted">Pick a stash yarn for each colour, or skip it. You can change it later.</p>
      {(yarns.error || start.error) && <ErrorBox error={yarns.error ?? start.error} />}
      {p.yarn_lines.map((l) => {
        const picked = picks[l.id];
        return (
          <div key={l.id} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3">
            <div className="flex items-center gap-2">
              {l.color_family && <span aria-hidden className="h-3.5 w-3.5 rounded-full border border-line" style={{ background: colourHex(l.color_family) }} />}
              <span className="flex-1">{[l.color, l.skeins !== null && skeinsText(Number(l.skeins))].filter(Boolean).join(' · ')}</span>
            </div>
            {picked && <span className="text-stash">→ {picked.name}</span>}
            <div className="flex gap-2">
              <button type="button" aria-label={`${picked ? 'Change' : 'Choose'} yarn for ${l.color}`}
                onClick={() => setOpen(open === l.id ? null : l.id)}
                className="h-11 rounded-full border border-line px-4 text-projects">{picked ? 'Change' : 'Choose yarn'}</button>
              {picked && (
                <button type="button" aria-label={`Skip ${l.color}`} className="h-11 px-3 text-muted"
                  onClick={() => setPicks((cur) => { const next = { ...cur }; delete next[l.id]; return next; })}>Skip</button>
              )}
            </div>
            {open === l.id && (
              <YarnPicker yarns={yarns.data ?? []} initialFamily={l.color_family}
                onPick={(y) => { setPicks((cur) => ({ ...cur, [l.id]: y })); setOpen(null); }} />
            )}
          </div>
        );
      })}
      <button type="button" disabled={start.isPending} onClick={startProject} className="h-14 rounded-full bg-projects text-lg text-white">
        Start project
      </button>
    </div>
  );
}
