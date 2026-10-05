export type PartDraft = { name: string; count: number; total_rows: number | null };
export type TypeChip = { id: string | 'all'; label: string };

export function buildTypeChips(types: { id: string; name: string }[], patternTypeIds: (string | null)[]): TypeChip[] {
  const counts = new Map<string, number>();
  for (const id of patternTypeIds) if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [
    { id: 'all', label: `All · ${patternTypeIds.length}` },
    ...types.filter((t) => counts.has(t.id)).map((t) => ({ id: t.id, label: `${t.name} · ${counts.get(t.id)}` })),
  ];
}

export function cleanPartDrafts(drafts: PartDraft[]) {
  return drafts
    .map((d) => ({ ...d, name: d.name.trim(), count: Math.max(1, Math.floor(d.count || 1)) }))
    .filter((d) => d.name !== '')
    .map((d, position) => ({ ...d, position }));
}

/** Position for a new type: after the last one, even when positions have gaps. */
export function nextTypePosition(types: { position: number }[]): number {
  return types.reduce((max, t) => Math.max(max, t.position + 1), 0);
}
