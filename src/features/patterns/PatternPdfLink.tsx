import { useSignedUrl } from '../../lib/storage';

/** Card that opens a pattern's whole PDF in the phone's viewer. Renders nothing without a PDF. */
export default function PatternPdfLink({ path, label = 'Open pattern PDF' }: { path: string | null | undefined; label?: string }) {
  const url = useSignedUrl('pattern-pdfs', path ?? null);
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer"
      className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3">
      <span className="flex h-12 w-10 items-center justify-center rounded-md bg-patterns-soft text-xs text-patterns">PDF</span>
      <span className="flex-1">{label}</span>
      <span className="text-patterns">›</span>
    </a>
  );
}
