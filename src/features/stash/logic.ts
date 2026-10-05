import { stockBadge } from '../../lib/calc';
import type { ProjectStatus, YarnWeight } from '../../lib/labels';
import type { Tables } from '../../lib/supabase';

export type Yarn = Tables<'yarns'>;
export type YarnWithStock = Yarn & { owned: number; used: number; reserved: number; free: number };

export function filterYarns(
  yarns: YarnWithStock[],
  f: { weight: YarnWeight | 'all'; fiber: string | 'all'; lowOnly: boolean },
): YarnWithStock[] {
  return yarns.filter(
    (y) =>
      (f.weight === 'all' || y.yarn_weight === f.weight) &&
      (f.fiber === 'all' || y.fiber === f.fiber) &&
      (!f.lowOnly || stockBadge(y.free) !== null),
  );
}

type ProjectRef = { id: string; name: string; status: ProjectStatus } | null;
export type YarnUsageRow = { projectId: string; name: string; status: ProjectStatus; planned: number; used: number };

export function mergeYarnUsage(
  planned: { skeins_planned: number; project: ProjectRef }[],
  used: { skeins_used: number; part: { project: ProjectRef } | null }[],
): YarnUsageRow[] {
  const rows = new Map<string, YarnUsageRow>();
  const row = (p: NonNullable<ProjectRef>) => {
    if (!rows.has(p.id)) rows.set(p.id, { projectId: p.id, name: p.name, status: p.status, planned: 0, used: 0 });
    return rows.get(p.id)!;
  };
  for (const pl of planned) if (pl.project) row(pl.project).planned += Number(pl.skeins_planned);
  for (const u of used) if (u.part?.project) row(u.part.project).used += Number(u.skeins_used);
  return [...rows.values()].map((r) => ({ ...r, used: Math.round(r.used * 100) / 100 }));
}
