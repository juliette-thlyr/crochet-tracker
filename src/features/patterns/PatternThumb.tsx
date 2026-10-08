import { useSignedUrl } from '../../lib/storage';

export default function PatternThumb({ path, className }: { path: string | null; className: string }) {
  const url = useSignedUrl('pattern-photos', path);
  return (
    <div className={`overflow-hidden bg-patterns-soft ${className}`}>
      {url && <img src={url} alt="" className="h-full w-full object-cover" />}
    </div>
  );
}
