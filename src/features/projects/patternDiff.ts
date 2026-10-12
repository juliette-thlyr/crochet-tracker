export type DiffPart = {
  id: string; name: string; position: number; total_rows: number | null;
  pattern_part_id: string | null; from_pattern: boolean; hasWork: boolean;
};
export type DiffPatternPart = { id: string; name: string; count: number; total_rows: number | null; position: number };
export type PatternChange =
  | { key: string; kind: 'add'; patternPartId: string; name: string; totalRows: number | null; afterPartId: string | null }
  | { key: string; kind: 'rename'; partId: string; from: string; to: string; defaultOn: boolean }
  | { key: string; kind: 'rows'; partId: string; name: string; from: number | null; to: number | null }
  | { key: string; kind: 'removed'; partId: string; name: string };

/** The project name of copy i (0-based) of a pattern part: the name alone when count is 1, else "Name i+1". */
const copyName = (p: DiffPatternPart, i: number) => (p.count === 1 ? p.name : `${p.name} ${i + 1}`);

/** What differs between a project's parts and its pattern's current parts. Rows, time and yarn are not compared. */
export function diffProjectWithPattern(parts: DiffPart[], patternParts: DiffPatternPart[]): PatternChange[] {
  const changes: PatternChange[] = [];
  const known = new Set(patternParts.map((p) => p.id));
  const byPosition = [...parts].sort((a, b) => a.position - b.position);

  for (const pp of [...patternParts].sort((a, b) => a.position - b.position)) {
    const linked = byPosition.filter((p) => p.pattern_part_id === pp.id);
    linked.slice(0, pp.count).forEach((part, i) => {
      const to = copyName(pp, i);
      if (part.name !== to) changes.push({ key: `rename:${part.id}`, kind: 'rename', partId: part.id, from: part.name, to, defaultOn: !part.hasWork });
      if (part.total_rows !== pp.total_rows) changes.push({ key: `rows:${part.id}`, kind: 'rows', partId: part.id, name: part.name, from: part.total_rows, to: pp.total_rows });
    });
    const last = linked.length > 0 ? linked[Math.min(linked.length, pp.count) - 1].id : null;
    for (let i = linked.length; i < pp.count; i++) {
      changes.push({ key: `add:${pp.id}:${i}`, kind: 'add', patternPartId: pp.id, name: copyName(pp, i), totalRows: pp.total_rows, afterPartId: last });
    }
    for (const extra of linked.slice(pp.count)) {
      changes.push({ key: `removed:${extra.id}`, kind: 'removed', partId: extra.id, name: extra.name });
    }
  }

  for (const part of byPosition) {
    if (part.from_pattern && (part.pattern_part_id === null || !known.has(part.pattern_part_id))) {
      changes.push({ key: `removed:${part.id}`, kind: 'removed', partId: part.id, name: part.name });
    }
  }
  return changes;
}

/** Ticked by default: additions, row changes and renames of untouched parts. Removals default to "keep". */
export function defaultTicks(changes: PatternChange[]): Set<string> {
  return new Set(changes.filter((c) => (c.kind === 'rename' ? c.defaultOn : c.kind !== 'removed')).map((c) => c.key));
}

/** The ticked changes in the shape `apply_pattern_update` expects. */
export function toRpcChanges(changes: PatternChange[], ticked: Set<string>): Record<string, unknown>[] {
  return changes.filter((c) => ticked.has(c.key)).map((c) => {
    switch (c.kind) {
      case 'add': return { kind: 'add', pattern_part_id: c.patternPartId, name: c.name, total_rows: c.totalRows, after_part_id: c.afterPartId };
      case 'rename': return { kind: 'rename', part_id: c.partId, name: c.to };
      case 'rows': return { kind: 'rows', part_id: c.partId, total_rows: c.to };
      case 'removed': return { kind: 'delete', part_id: c.partId };
    }
  });
}
