import { useState } from 'react';
import ColourDots from '../../components/ColourDots';
import { formatSkeins } from '../../lib/calc';
import { COLOUR_FAMILIES, type ColourFamily } from '../../lib/colours';
import { filterYarns, type YarnWithStock } from '../stash/logic';

type Props = { yarns: YarnWithStock[]; initialFamily: ColourFamily | null; onPick: (y: YarnWithStock) => void };

/** Pick a stash yarn: starts on the line's colour family; typing a search looks through every colour. */
export default function YarnPicker({ yarns, initialFamily, onPick }: Props) {
  const [family, setFamily] = useState<ColourFamily | null>(initialFamily);
  const [search, setSearch] = useState('');
  const families = COLOUR_FAMILIES.map((c) => c.value).filter((f) => yarns.some((y) => y.color_family === f));
  const shown = filterYarns(yarns, { weight: 'all', fiber: 'all', lowOnly: false, search, family: family ?? 'all' });

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-2.5">
      <input type="search" aria-label="Search stash" placeholder="Search name, brand or colour" value={search}
        onChange={(e) => { setSearch(e.target.value); setFamily(null); }}
        className="h-11 rounded-full border border-line bg-surface px-4" />
      {families.length > 0 && <ColourDots label="Yarn colour" value={family} families={families} onChange={setFamily} />}
      {shown.length === 0 && <p className="text-sm text-muted">No yarn here. Tap the dot again to see every colour.</p>}
      <ul className="flex flex-col">
        {shown.map((y) => (
          <li key={y.id}>
            <button type="button" onClick={() => onPick(y)}
              className="flex min-h-11 w-full items-center justify-between gap-2 border-b border-divider px-1 text-left last:border-b-0">
              <span className="text-stash">{y.name}</span>
              <span className="text-xs text-muted">{[y.brand, `${formatSkeins(y.free)} free`].filter(Boolean).join(' · ')}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
