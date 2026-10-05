import { Link, useLocation } from 'react-router';
import { formatClock, rowLabel, sumSeconds } from '../../lib/calc';
import { useRunningSession, useSetRow, useStopTimer } from './api';
import { useNow } from './useNow';

export default function TimerBar() {
  const { pathname } = useLocation();
  const { data: running } = useRunningSession();
  const setRow = useSetRow();
  const stop = useStopTimer();
  const now = useNow();
  if (!running || pathname.startsWith('/timer')) return null;

  const { part } = running;
  const others = part.time_sessions.filter((s) => s.ended_at !== null);
  const seconds = sumSeconds([...others, { started_at: running.started_at, ended_at: null }], now);

  return (
    <div className="bg-timer text-white">
      <div className="flex h-14 items-center gap-2.5 pl-4 pr-2.5">
        <Link to={`/parts/${part.id}`} className="flex min-h-11 flex-1 items-center gap-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-row" />
          <span className="flex flex-col">
            <span className="text-sm">{part.name} · {part.project.name}</span>
            <span className="text-xs opacity-90">{formatClock(seconds)} · {rowLabel(part.current_row, part.total_rows)}</span>
          </span>
        </Link>
        <button type="button" onClick={() => setRow.mutate({ partId: part.id, row: (part.current_row ?? 0) + 1 })}
          className="h-11 rounded-full bg-row px-3.5 text-sm text-row-ink">+ row</button>
        <button type="button" aria-label="Stop timer" onClick={() => stop.mutate()}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-surface">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="1" y="1" width="12" height="12" rx="2" fill="#4169E1" /></svg>
        </button>
      </div>
      {(setRow.isError || stop.isError) && <p role="alert" className="px-4 pb-2 text-xs">Couldn't save — try again</p>}
    </div>
  );
}
