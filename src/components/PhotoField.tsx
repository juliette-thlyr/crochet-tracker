import { useEffect, useState } from 'react';
import { useSignedUrl, type Bucket } from '../lib/storage';

type Props = {
  label: string;
  bucket: Bucket;
  path: string | null;
  file: File | null;
  onFile: (f: File | null) => void;
  onRemove: () => void;
};

export default function PhotoField({ label, bucket, path, file, onFile, onRemove }: Props) {
  const stored = useSignedUrl(bucket, file ? null : path);
  const [local, setLocal] = useState<string | null>(null);

  useEffect(() => {
    if (!file) { setLocal(null); return; }
    const url = URL.createObjectURL(file);
    setLocal(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const preview = local ?? stored ?? null;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm text-muted">{label}</span>
      <div className="flex items-center gap-3">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-divider">
          {preview && <img src={preview} alt="Photo preview" className="h-full w-full object-cover" />}
        </div>
        <div className="flex flex-col gap-2">
          <label className="flex min-h-11 cursor-pointer items-center rounded-full border-[1.5px] border-dashed border-muted bg-surface px-4 text-sm">
            Take or choose a photo
            <input type="file" accept="image/*" className="sr-only" aria-label="Take or choose a photo"
              onChange={(e) => { onFile(e.target.files?.[0] ?? null); e.target.value = ''; }} />
          </label>
          {(file || path) && (
            <button type="button" onClick={() => { onFile(null); onRemove(); }} className="min-h-11 self-start text-sm text-muted">
              Remove photo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
