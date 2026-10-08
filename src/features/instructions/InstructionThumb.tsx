import { useSignedUrl } from '../../lib/storage';

export default function InstructionThumb({ path, alt, className }: { path: string; alt: string; className: string }) {
  const url = useSignedUrl('pattern-instructions', path);
  return (
    <div className={`overflow-hidden bg-divider ${className}`}>
      {url && <img src={url} alt={alt} className="h-full w-full object-contain" />}
    </div>
  );
}
