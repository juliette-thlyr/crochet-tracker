import ColourDots from '../../components/ColourDots';
import NumberField from '../../components/NumberField';
import SuggestField from '../../components/SuggestField';
import type { MaterialDraft, YarnLineDraft } from './logic';

type Props = {
  yarnLines: YarnLineDraft[];
  onYarnLines: (v: YarnLineDraft[]) => void;
  materials: MaterialDraft[];
  onMaterials: (v: MaterialDraft[]) => void;
  yarnTypes: string[];
  materialNames: string[];
};

const field = 'h-11 rounded-xl border border-line bg-surface';
const h3 = 'text-sm text-muted';

export default function MaterialsSection({ yarnLines, onYarnLines, materials, onMaterials, yarnTypes, materialNames }: Props) {
  const setLine = (i: number, patch: Partial<YarnLineDraft>) => onYarnLines(yarnLines.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const setMaterial = (i: number, patch: Partial<MaterialDraft>) => onMaterials(materials.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <section aria-labelledby="materials-heading" className="flex flex-col gap-2">
      <h2 id="materials-heading" className="mt-1 text-sm uppercase tracking-wide text-muted">Materials</h2>

      <h3 className={h3}>Yarns · colour · skeins</h3>
      {yarnLines.map((line, i) => (
        <div key={i} className="flex flex-col gap-1.5 rounded-2xl border border-line bg-surface p-2.5">
          <div className="flex items-center gap-1.5">
            <input aria-label="Colour" placeholder="Colour" value={line.color}
              required={line.skeins !== null || line.yarn_type.trim() !== ''}
              onChange={(e) => setLine(i, { color: e.target.value })} className={`${field} min-w-0 flex-1 px-2.5`} />
            <NumberField aria-label="Skeins" value={line.skeins} min={0} step={0.25}
              onChange={(v) => setLine(i, { skeins: v })} className={`${field} w-16 text-center`} />
            <button type="button" aria-label="Remove yarn line" className="h-11 w-11 text-muted"
              onClick={() => onYarnLines(yarnLines.filter((_, j) => j !== i))}>×</button>
          </div>
          <ColourDots label={`Colour family of yarn ${i + 1}`} value={line.color_family}
            onChange={(v) => setLine(i, { color_family: v })} />
          <SuggestField label="Yarn type" value={line.yarn_type} suggestions={yarnTypes}
            onChange={(v) => setLine(i, { yarn_type: v })} />
        </div>
      ))}
      <button type="button" className="h-11 self-start text-patterns"
        onClick={() => onYarnLines([...yarnLines, { color: '', color_family: null, skeins: null, yarn_type: '' }])}>+ Yarn</button>

      <h3 className={h3}>Other materials · quantity</h3>
      {materials.map((m, i) => (
        <div key={i} className="flex items-end gap-1.5">
          <div className="min-w-0 flex-1">
            <SuggestField label="Material" value={m.name} suggestions={materialNames} required={m.quantity !== null}
              onChange={(v) => setMaterial(i, { name: v })} />
          </div>
          <NumberField aria-label="Quantity" value={m.quantity} min={0}
            onChange={(v) => setMaterial(i, { quantity: v })} className={`${field} w-16 text-center`} />
          <button type="button" aria-label="Remove material" className="h-11 w-11 text-muted"
            onClick={() => onMaterials(materials.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <button type="button" className="h-11 self-start text-patterns"
        onClick={() => onMaterials([...materials, { name: '', quantity: null }])}>+ Material</button>
    </section>
  );
}
