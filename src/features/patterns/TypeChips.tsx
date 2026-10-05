import type { TypeChip } from './logic';

const onClass = { patterns: 'bg-patterns text-white', projects: 'bg-projects text-white' };

type Props = {
  chips: TypeChip[];
  selected: string;
  onSelect: (id: string) => void;
  tone: 'patterns' | 'projects';
};

export default function TypeChips({ chips, selected, onSelect, tone }: Props) {
  return (
    <div role="group" aria-label="Filter by type" className="-mx-4 flex gap-2 overflow-x-auto px-4">
      {chips.map((c) => (
        <button
          key={c.id}
          type="button"
          aria-pressed={c.id === selected}
          onClick={() => onSelect(c.id)}
          className={`h-11 shrink-0 rounded-full px-3.5 text-sm ${c.id === selected ? onClass[tone] : 'border border-line bg-surface'}`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
