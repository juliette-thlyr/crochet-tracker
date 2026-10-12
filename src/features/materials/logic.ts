import type { ColourFamily } from '../../lib/colours';

export type YarnLineDraft = { id?: string; color: string; color_family: ColourFamily | null; skeins: number | null; yarn_type: string };
export type MaterialDraft = { id?: string; name: string; quantity: number | null };

export function cleanYarnLines(drafts: YarnLineDraft[]) {
  return drafts
    .map((d) => ({ ...d, color: d.color.trim(), yarn_type: d.yarn_type.trim() === '' ? null : d.yarn_type.trim() }))
    .filter((d) => d.color !== '')
    .map((d, position) => ({ ...d, position }));
}

export function cleanMaterials(drafts: MaterialDraft[]) {
  return drafts
    .map((d) => ({ ...d, name: d.name.trim(), quantity: d.quantity !== null && d.quantity > 0 ? d.quantity : null }))
    .filter((d) => d.name !== '')
    .map((d, position) => ({ ...d, position }));
}

/** What saving must do so that kept rows keep their id. */
export function planRows<T extends { id?: string }>(existingIds: string[], rows: T[]) {
  const existing = new Set(existingIds);
  const updates: (Omit<T, 'id'> & { id: string })[] = [];
  const inserts: Omit<T, 'id'>[] = [];
  for (const { id, ...row } of rows) {
    if (id && existing.has(id)) updates.push({ id, ...row });
    else inserts.push(row);
  }
  const kept = new Set(updates.map((u) => u.id));
  return { updates, inserts, deleteIds: existingIds.filter((id) => !kept.has(id)) };
}

/** "1 skein", "2 skeins"; fractions read as "0.5 skein". */
export function skeinsText(n: number): string {
  return `${Number(n.toFixed(2))} ${n > 1 ? 'skeins' : 'skein'}`;
}
