import type { ProjectStatus } from '../../lib/labels';

export const STATUS_ORDER: ProjectStatus[] = ['in_progress', 'idea', 'finished', 'frogged'];

export function groupProjects<T extends { status: ProjectStatus }>(list: T[]) {
  return STATUS_ORDER
    .map((status) => ({ status, items: list.filter((p) => p.status === status) }))
    .filter((g) => g.items.length > 0);
}

type YarnRef = { id: string; name: string } | null;
export type YarnLine = { yarnId: string; name: string; used: number; planned: number | null };

export function projectYarnLines(
  parts: { part_yarns: { id: string; skeins_used: number; yarn: YarnRef }[] }[],
  plans: { id: string; skeins_planned: number; yarn: YarnRef }[],
): YarnLine[] {
  const lines = new Map<string, YarnLine>();
  const line = (y: NonNullable<YarnRef>) => {
    if (!lines.has(y.id)) lines.set(y.id, { yarnId: y.id, name: y.name, used: 0, planned: null });
    return lines.get(y.id)!;
  };
  for (const p of plans) if (p.yarn) line(p.yarn).planned = Number(p.skeins_planned);
  for (const part of parts) for (const u of part.part_yarns) if (u.yarn) line(u.yarn).used += Number(u.skeins_used);
  return [...lines.values()]
    .map((l) => ({ ...l, used: Math.round(l.used * 100) / 100 }))
    .sort((a, b) => b.used - a.used || a.name.localeCompare(b.name));
}
