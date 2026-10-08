import { useSignedUrl } from '../../lib/storage';

type Props = { items: { path: string; label: string }[]; index: number; onIndex: (i: number) => void; onClose: () => void };

export default function InstructionViewer({ items, index, onIndex, onClose }: Props) {
  const item = items[index];
  const url = useSignedUrl('pattern-instructions', item?.path ?? null);
  if (!item) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label="Instructions" className="fixed inset-0 z-50 flex flex-col bg-ink text-white">
      <div className="flex items-center justify-between p-2">
        <span className="px-2 text-sm">{item.label} · {index + 1}/{items.length}</span>
        <button type="button" onClick={onClose} className="h-11 rounded-full px-4">Close</button>
      </div>
      <div className="flex-1 overflow-auto" style={{ touchAction: 'pinch-zoom' }}>
        {url && <img src={url} alt={`Instructions ${item.label}`} className="w-full" />}
      </div>
      <div className="flex justify-between p-2">
        <button type="button" disabled={index === 0} onClick={() => onIndex(index - 1)} className="h-11 rounded-full px-4 disabled:opacity-40">Previous</button>
        <button type="button" disabled={index === items.length - 1} onClick={() => onIndex(index + 1)} className="h-11 rounded-full px-4 disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}
