import { WEIGHTS, type YarnWeight } from '../../lib/labels';

export type CatalogLine = { brand: string; name: string; yarn_weight: YarnWeight | null; fiber: string | null };

function weightOf(text: string): YarnWeight | null | undefined {
  const t = text.trim().toLowerCase();
  if (t === '') return null;
  return WEIGHTS.find((w) => w.label.toLowerCase() === t || w.value === t)?.value; // undefined = unknown
}

/** "Brand ; Yarn name ; Weight ; Fiber" per line. Weight and fiber are optional. */
export function parseYarnList(text: string): { entries: CatalogLine[]; rejected: number[] } {
  const entries: CatalogLine[] = [];
  const rejected: number[] = [];
  const seen = new Set<string>();
  text.split(/\r?\n/).forEach((raw, i) => {
    if (raw.trim() === '') return;
    const [brand = '', name = '', weight = '', fiber = ''] = raw.split(';').map((s) => s.trim());
    const yarn_weight = weightOf(weight);
    if (brand === '' || name === '' || yarn_weight === undefined) {
      rejected.push(i + 1);
      return;
    }
    const key = `${brand.toLowerCase()}|${name.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({ brand, name, yarn_weight, fiber: fiber === '' ? null : fiber });
  });
  return { entries, rejected };
}

/** One name per line. */
export function parseNameList(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/\r?\n/)) {
    const name = raw.trim();
    if (name === '' || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
  }
  return out;
}

export function importSummary(r: { added: number; skipped: number }, rejected: number[]): string {
  const parts = [`${r.added} added`, `${r.skipped} already there`];
  if (rejected.length === 1) parts.push(`1 line not understood (line ${rejected[0]})`);
  if (rejected.length > 1) parts.push(`${rejected.length} lines not understood (lines ${rejected.join(', ')})`);
  return parts.join(', ');
}
