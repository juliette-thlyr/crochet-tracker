export default function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    <div role="alert" className="m-4 flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <p>Something went wrong: {message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="h-11 self-start rounded-full bg-ink px-5 text-white">
          Try again
        </button>
      )}
    </div>
  );
}
