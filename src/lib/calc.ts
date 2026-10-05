export type SessionLike = { started_at: string; ended_at: string | null };

export function sessionSeconds(s: SessionLike, now: Date): number {
  const start = new Date(s.started_at).getTime();
  const end = s.ended_at ? new Date(s.ended_at).getTime() : now.getTime();
  return Math.max(0, Math.floor((end - start) / 1000));
}

export function sumSeconds(sessions: SessionLike[], now: Date): number {
  return sessions.reduce((total, s) => total + sessionSeconds(s, now), 0);
}

const pad = (n: number) => String(n).padStart(2, '0');

export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m}m` : `${h}h ${pad(m)}m`;
}

export function formatClock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${pad(m)}:${pad(s)}`;
}

export type PatternPartLike = { name: string; count: number; total_rows: number | null };

export function expandPatternParts(parts: PatternPartLike[]) {
  return parts.flatMap((p) =>
    p.count <= 1
      ? [{ name: p.name, total_rows: p.total_rows }]
      : Array.from({ length: p.count }, (_, i) => ({ name: `${p.name} ${i + 1}`, total_rows: p.total_rows })),
  );
}

export function clampRow(n: number): number {
  return Math.max(0, Math.floor(n));
}

export function rowLabel(current: number | null, total: number | null): string {
  if (current === null) return '—';
  return total === null ? `Row ${current}` : `Row ${current}/${total}`;
}

export function rowProgress(current: number | null, total: number | null): number {
  if (current === null || total === null || total <= 0) return 0;
  return Math.min(100, Math.round((current / total) * 100));
}

export function stockBadge(free: number): 'low' | 'out' | null {
  if (free <= 0) return 'out';
  if (free < 1) return 'low';
  return null;
}

export const HOOK_MIN = 1;
export const HOOK_MAX = 12;
export const HOOK_STEP = 0.5;

export function hookSizeOptions(): number[] {
  const count = (HOOK_MAX - HOOK_MIN) / HOOK_STEP + 1;
  return Array.from({ length: count }, (_, i) => HOOK_MIN + i * HOOK_STEP);
}

export function formatHook(mm: number | null): string {
  return mm === null ? '—' : `${mm.toFixed(1)} mm`;
}

export function hookLabel(used: number | null, recommended: number | null): string {
  if (used === null) return 'hook —';
  if (recommended === null || recommended === used) return `hook ${formatHook(used)}`;
  return `hook ${formatHook(used)} (pattern: ${formatHook(recommended)})`;
}

export function formatSkeins(n: number): string {
  return `${Number(n.toFixed(2))} sk`;
}

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });

export function formatEuros(n: number | null): string {
  return n === null ? '—' : euros.format(n);
}
