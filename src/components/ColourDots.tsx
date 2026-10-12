import { COLOUR_FAMILIES, type ColourFamily } from '../lib/colours';

type Props = {
  label: string;
  value: ColourFamily | null;
  onChange: (v: ColourFamily | null) => void;
  families?: ColourFamily[];
};

/** A scrollable row of colour-family dots. Tapping the selected dot clears the choice. */
export default function ColourDots({ label, value, onChange, families }: Props) {
  const shown = families ? COLOUR_FAMILIES.filter((c) => families.includes(c.value)) : COLOUR_FAMILIES;
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 overflow-x-auto">
      {shown.map((c) => {
        const on = value === c.value;
        return (
          <button key={c.value} type="button" role="radio" aria-checked={on} aria-label={c.label}
            onClick={() => onChange(on ? null : c.value)}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${on ? 'ring-2 ring-inset ring-ink' : ''}`}>
            <span className="h-7 w-7 rounded-full border border-line" style={{ background: c.hex }} />
          </button>
        );
      })}
    </div>
  );
}
