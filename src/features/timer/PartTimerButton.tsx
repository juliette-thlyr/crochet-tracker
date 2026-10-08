import { formatClock, sessionSeconds } from '../../lib/calc';
import { useRunningSession, useStartTimer, useStopTimer } from './api';
import { useNow } from './useNow';

export default function PartTimerButton({ partId }: { partId: string }) {
  const running = useRunningSession();
  const start = useStartTimer();
  const stop = useStopTimer();
  const now = useNow();
  const session = running.data?.part.id === partId ? running.data : null;
  const failed = session ? stop.error : start.error;

  return (
    <div className="flex flex-col gap-1">
      {session ? (
        <button type="button" aria-label="Stop timing" onClick={() => stop.mutate()}
          className="min-h-14 rounded-full bg-timer text-lg text-white">
          ■ Stop · {formatClock(sessionSeconds({ started_at: session.started_at, ended_at: null }, now))}
        </button>
      ) : (
        <button type="button" aria-label="Start timing" onClick={() => start.mutate(partId)}
          className="min-h-14 rounded-full bg-timer text-lg text-white">
          ▶ Start timing
        </button>
      )}
      {failed && <p role="alert" className="text-sm text-projects-dark">{session ? "Couldn't stop" : "Couldn't start"}</p>}
    </div>
  );
}
