import { useRunningSession, useStartTimer, useStopTimer } from './api';

export default function StartTimerButton({ partId, label }: { partId: string; label: string }) {
  const running = useRunningSession();
  const start = useStartTimer();
  const stop = useStopTimer();
  const isRunning = running.data?.part.id === partId;
  const failed = isRunning ? stop.error : start.error;
  const title = failed ? "Couldn't save — try again" : undefined;
  return (
    <span className="flex flex-col items-center">
      {isRunning ? (
        <button type="button" aria-label="Stop timer" title={title} onClick={() => stop.mutate()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-timer text-white">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect width="12" height="12" rx="2" fill="currentColor" /></svg>
        </button>
      ) : (
        <button type="button" aria-label={`Start timer for ${label}`} title={title} onClick={() => start.mutate(partId)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-timer">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5v11l9-5.5z" fill="currentColor" /></svg>
        </button>
      )}
      {failed && (
        <span role="alert" className="text-[10px] leading-tight text-projects-dark">
          {isRunning ? "Couldn't stop" : "Couldn't start"}
        </span>
      )}
    </span>
  );
}
