import { COLOUR_FAMILIES, type ColourFamily } from '../lib/colours';

type Props = {
  label: string;
  value: ColourFamily | null;
  onChange: (v: ColourFamily | null) => void;
  families?: ColourFamily[];
};

const dotClass = (on: boolean) =>
  `flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${on ? 'ring-2 ring-inset ring-ink' : ''}`;

function Swatch({ hex }: { hex: string }) {
  return <span className="h-7 w-7 rounded-full border border-line" style={{ background: hex }} />;
}

/** A scrollable row of colour-family dots. Tapping the selected dot clears the choice. */
export default function ColourDots({ label, value, onChange, families }: Props) {
  const shown = families ? COLOUR_FAMILIES.filter((c) => families.includes(c.value)) : COLOUR_FAMILIES;
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 overflow-x-auto">
      {shown.map((c) => {
        const on = value === c.value;
        return (
          <button key={c.value} type="button" role="radio" aria-checked={on} aria-label={c.label}
            onClick={() => onChange(on ? null : c.value)} className={dotClass(on)}>
            <Swatch hex={c.hex} />
          </button>
        );
      })}
    </div>
  );
}

export const MAX_FAMILIES = 2;

/** Pick up to two families (teal = blue + green). A third tap drops the oldest choice; tapping a chosen dot removes it. */
export function MultiColourDots({ label, value, onChange }: { label: string; value: ColourFamily[]; onChange: (v: ColourFamily[]) => void }) {
  return (
    <div role="group" aria-label={label} className="flex gap-1 overflow-x-auto">
      {COLOUR_FAMILIES.map((c) => {
        const on = value.includes(c.value);
        return (
          <button key={c.value} type="button" role="checkbox" aria-checked={on} aria-label={c.label}
            onClick={() => onChange(on ? value.filter((v) => v !== c.value) : [...value, c.value].slice(-MAX_FAMILIES))}
            className={dotClass(on)}>
            <Swatch hex={c.hex} />
          </button>
        );
      })}
    </div>
  );
}
