import { colourHex } from '../../lib/colours';
import type { Tables } from '../../lib/supabase';
import { skeinsText } from './logic';

type Props = { yarnLines: Tables<'pattern_yarns'>[]; materials: Tables<'pattern_materials'>[] };

export default function MaterialsList({ yarnLines, materials }: Props) {
  if (yarnLines.length === 0 && materials.length === 0) return null;
  return (
    <>
      <h2 className="text-sm uppercase tracking-wide text-muted">Materials</h2>
      <ul className="rounded-2xl border border-line bg-surface">
        {yarnLines.map((y) => (
          <li key={y.id} className="flex items-center gap-2 border-b border-divider px-3.5 py-2.5 last:border-b-0">
            {y.color_family && (
              <span aria-hidden className="h-3.5 w-3.5 shrink-0 rounded-full border border-line" style={{ background: colourHex(y.color_family) }} />
            )}
            {[y.color, y.skeins !== null && skeinsText(Number(y.skeins)), y.yarn_type].filter(Boolean).join(' · ')}
          </li>
        ))}
        {materials.map((m) => (
          <li key={m.id} className="border-b border-divider px-3.5 py-2.5 last:border-b-0">
            {m.quantity === null ? m.name : `${m.name} × ${Number(m.quantity)}`}
          </li>
        ))}
      </ul>
    </>
  );
}
