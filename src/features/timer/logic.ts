export type RecentPart = {
  id: string; name: string; done: boolean; current_row: number | null; total_rows: number | null;
  resume_note: string | null; project: { name: string } | null;
};
export type RecentRow = { started_at: string; part: RecentPart | null };

export function recentParts(rows: RecentRow[], excludePartId: string | null, limit = 5) {
  const seen = new Set<string>();
  const out: (RecentPart & { lastWorked: string })[] = [];
  for (const r of rows) {
    if (!r.part || r.part.id === excludePartId || seen.has(r.part.id)) continue;
    seen.add(r.part.id);
    out.push({ ...r.part, lastWorked: r.started_at });
    if (out.length === limit) break;
  }
  return out;
}
