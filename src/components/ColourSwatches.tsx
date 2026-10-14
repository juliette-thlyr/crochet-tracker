import { colourHex, colourLabel, type ColourFamily } from '../lib/colours';

/** Read-only colour-family dots, e.g. next to a yarn's colour name. */
export default function ColourSwatches({ families, size = 'h-3 w-3' }: { families: ColourFamily[]; size?: string }) {
  if (families.length === 0) return null;
  return (
    <span className="flex shrink-0 gap-0.5" title={families.map(colourLabel).join(' + ')}>
      {families.map((f) => (
        <span key={f} aria-hidden className={`${size} rounded-full border border-line`} style={{ background: colourHex(f) }} />
      ))}
    </span>
  );
}
