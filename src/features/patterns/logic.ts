export type PartDraft = { id?: string; name: string; count: number; total_rows: number | null };
export type CleanPart = { name: string; count: number; total_rows: number | null; position: number };
export type TypeChip = { id: string | 'all'; label: string };

export function buildTypeChips(types: { id: string; name: string }[], patternTypeIds: (string | null)[]): TypeChip[] {
  const counts = new Map<string, number>();
  for (const id of patternTypeIds) if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [
    { id: 'all', label: `All · ${patternTypeIds.length}` },
    ...types.filter((t) => counts.has(t.id)).map((t) => ({ id: t.id, label: `${t.name} · ${counts.get(t.id)}` })),
  ];
}

export function cleanPartDrafts(drafts: PartDraft[]): (CleanPart & { id?: string })[] {
  return drafts
    .map((d) => ({ ...d, name: d.name.trim(), count: Math.max(1, Math.floor(d.count || 1)) }))
    .filter((d) => d.name !== '')
    .map((d, position) => ({ ...d, position }));
}

/** What saving the form must do so that kept parts keep their id (and their instructions). */
export function planPartChanges(existingIds: string[], drafts: PartDraft[]) {
  const existing = new Set(existingIds);
  const cleaned = cleanPartDrafts(drafts);
  const updates: (CleanPart & { id: string })[] = [];
  const inserts: CleanPart[] = [];
  for (const { id, ...part } of cleaned) {
    if (id && existing.has(id)) updates.push({ id, ...part });
    else inserts.push(part);
  }
  const kept = new Set(updates.map((u) => u.id));
  return { updates, inserts, deleteIds: existingIds.filter((id) => !kept.has(id)) };
}

/** Position for a new type: after the last one, even when positions have gaps. */
export function nextTypePosition(types: { position: number }[]): number {
  return types.reduce((max, t) => Math.max(max, t.position + 1), 0);
}
