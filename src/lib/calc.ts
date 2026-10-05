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
