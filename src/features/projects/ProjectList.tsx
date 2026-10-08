import { Link } from 'react-router';
import ErrorBox from '../../components/ErrorBox';
import { formatDuration } from '../../lib/calc';
import { STATUS_LABELS } from '../../lib/labels';
import { useSignedUrl } from '../../lib/storage';
import { useProjects, type ProjectListItem } from './api';
import { groupProjects } from './logic';
import PageTitle from '../../components/PageTitle';

export default function ProjectList() {
  const { data, isPending, error, refetch } = useProjects();
  if (error) return <ErrorBox error={error} onRetry={() => refetch()} />;
  if (isPending) return <p className="p-4 text-muted">Loading…</p>;

  return (
    <div className="flex flex-col gap-3 p-4">
      <header className="flex items-center justify-between pt-2">
        <PageTitle color="text-projects">Projects</PageTitle>
        <Link to="/projects/new" className="flex h-11 items-center rounded-full bg-projects px-5 text-white">+ New</Link>
      </header>
      {data.length === 0 && <p className="text-muted">No projects yet. Start one from a pattern.</p>}
      {groupProjects(data).map((g) => (
        <section key={g.status} className="flex flex-col gap-2.5">
          <h2 className="mt-2 text-sm uppercase tracking-wide text-muted">{STATUS_LABELS[g.status]} · {g.items.length}</h2>
          {g.items.map((p) => <ProjectCard key={p.id} project={p} />)}
        </section>
      ))}
    </div>
  );
}

function ProjectCard({ project: p }: { project: ProjectListItem }) {
  const photo = useSignedUrl('project-photos', p.photo);
  const pct = p.partsTotal ? Math.round((p.partsDone / p.partsTotal) * 100) : 0;
  return (
    <Link to={`/projects/${p.id}`} className="flex gap-3 rounded-2xl border border-line bg-surface p-3">
      <div className="h-[76px] w-[76px] shrink-0 overflow-hidden rounded-xl bg-projects-soft">
        {photo && <img src={photo} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-lg text-projects">{p.name}</span>
          <span className="text-sm text-muted">{formatDuration(p.seconds)}</span>
        </span>
        <span className="text-sm text-muted">{p.pattern?.name ?? 'No pattern'}</span>
        <div className="h-1.5 overflow-hidden rounded bg-sun-track"><div className="h-1.5 bg-stash" style={{ width: `${pct}%` }} /></div>
        <span className="text-sm text-stash">{p.partsDone} of {p.partsTotal} parts done</span>
      </div>
    </Link>
  );
}
