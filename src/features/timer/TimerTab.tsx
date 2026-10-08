import { Link } from 'react-router';
import ErrorBox from '../../components/ErrorBox';
import { formatClock, formatDuration, rowLabel, sessionSeconds, sumSeconds } from '../../lib/calc';
import { useRecentParts, useRunningSession, useSetRow, useStopTimer, type RunningSession } from './api';
import { recentParts } from './logic';
import StartTimerButton from './StartTimerButton';
import { useNow } from './useNow';
import PageTitle from '../../components/PageTitle';

export default function TimerTab() {
  const { data: running } = useRunningSession();
  const recent = useRecentParts();
  const setRow = useSetRow();
  const stop = useStopTimer();
  const now = useNow();
  const list = recentParts(recent.data ?? [], running?.part.id ?? null);
  const error = setRow.error ?? stop.error ?? recent.error;

  return (
    <div className="flex flex-col gap-4 p-4">
      <PageTitle color="text-timer" className="pt-2">Timer</PageTitle>
      {error && <ErrorBox error={error} />}
      {running ? (
        runningCard(running)
      ) : (
        <p className="rounded-3xl border border-line bg-surface p-5 text-muted">Nothing is being timed.</p>
      )}
      <h2 className="text-sm uppercase tracking-wide text-muted">Pick up again</h2>
      <ul className="rounded-2xl border border-line bg-surface">
        {list.map((p) => (
          <li key={p.id} className="flex items-center gap-2.5 border-b border-divider py-1.5 pl-3.5 pr-2 last:border-b-0">
            <span className="flex flex-1 flex-col">
              <span className="text-timer">{p.name} · {p.project?.name}</span>
              <span className="text-xs text-muted">
                {p.done ? 'Done' : rowLabel(p.current_row, p.total_rows)}
                {p.resume_note && ` · ${p.resume_note}`}
              </span>
            </span>
            <StartTimerButton partId={p.id} label={p.name} />
          </li>
        ))}
        {list.length === 0 && <li className="px-3.5 py-3 text-muted">Start a timer from a project's parts.</li>}
      </ul>
    </div>
  );

  // A plain render helper (not a component) so the card isn't remounted on every clock tick.
  function runningCard(r: RunningSession) {
    const { part } = r;
    const closed = part.time_sessions.filter((s) => s.ended_at !== null);
    const current = { started_at: r.started_at, ended_at: null };
    return (
      <section className="flex flex-col items-center gap-4 rounded-3xl bg-timer px-5 py-6 text-white">
        <Link to={`/parts/${part.id}`} className="flex min-h-11 items-center">{part.project.name} · {part.name} ›</Link>
        <span className="text-7xl leading-none">{formatClock(sumSeconds([...closed, current], now))}</span>
        <span className="text-sm opacity-90">
          This session {formatDuration(sessionSeconds(current, now))} · part total {formatDuration(sumSeconds([...closed, current], now))}
        </span>
        <div className="flex w-full items-center justify-between rounded-2xl bg-timer-dark p-3">
          <button type="button" aria-label="Previous row"
            onClick={() => setRow.mutate({ partId: part.id, row: (part.current_row ?? 0) - 1 })}
            className="h-13 w-13 rounded-full bg-timer-darker text-2xl">−</button>
          <span className="text-lg">Row <b className="text-3xl">{part.current_row ?? 0}</b>{part.total_rows !== null && ` / ${part.total_rows}`}</span>
          <button type="button" onClick={() => setRow.mutate({ partId: part.id, row: (part.current_row ?? 0) + 1 })}
            className="h-13 rounded-full bg-row px-5 text-lg text-row-ink">+ row</button>
        </div>
        <button type="button" onClick={() => stop.mutate()} className="h-14 w-full rounded-full bg-sun text-lg text-ink">Stop</button>
      </section>
    );
  }
}
