import { useState } from 'react';
import { Link } from 'react-router';
import ConfirmDialog from '../../components/ConfirmDialog';
import ErrorBox from '../../components/ErrorBox';
import { weightLabel } from '../../lib/labels';
import {
  useCatalog, useDeleteListEntry, useFibers, useImportLists, useRenameListEntry, useShops, type ListTable,
} from './api';
import { importSummary, parseNameList, parseYarnList } from './parse';

const h2 = 'text-sm uppercase tracking-wide text-muted';
type Target = { table: ListTable; id: string; label: string };

export default function ManageListsPage() {
  const catalog = useCatalog();
  const shops = useShops();
  const fibers = useFibers();
  const rename = useRenameListEntry();
  const remove = useDeleteListEntry();
  const [editing, setEditing] = useState<(Target & { value: string }) | null>(null);
  const [removing, setRemoving] = useState<Target | null>(null);

  const brands = [...new Set((catalog.data ?? []).map((c) => c.brand))];
  const error = catalog.error ?? shops.error ?? fibers.error ?? rename.error ?? remove.error;

  // A render helper, not a component: a nested component would remount on each keystroke and drop focus.
  function row(target: Target, text: string) {
    const isEditing = editing?.table === target.table && editing.id === target.id;
    return (
      <li key={`${target.table}-${target.id}`} className="flex items-center gap-1.5 border-b border-divider px-3 py-1 last:border-b-0">
        {isEditing && editing ? (
          <>
            <input autoFocus aria-label={`New name for ${target.label}`} value={editing.value}
              onChange={(e) => setEditing({ ...editing, value: e.target.value })}
              className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-2.5" />
            <button type="button" className="h-11 px-2 text-stash"
              onClick={() => {
                if (editing.value.trim()) {
                  rename.mutate({ table: target.table, id: target.id, patch: { name: editing.value } },
                    { onSuccess: () => setEditing(null) });
                }
              }}>Save</button>
          </>
        ) : (
          <>
            <span className="flex-1">{text}</span>
            <button type="button" aria-label={`Rename ${target.label}`} className="h-11 px-2 text-sm text-stash"
              onClick={() => setEditing({ ...target, value: target.label })}>Rename</button>
            <button type="button" aria-label={`Remove ${target.label}`} className="h-11 w-11 text-muted"
              onClick={() => setRemoving(target)}>×</button>
          </>
        )}
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <Link to="/stash" className="flex min-h-11 items-center self-start text-stash">‹ Stash</Link>
      <h1 className="text-3xl text-stash">Manage lists</h1>
      <p className="text-sm text-muted">Suggestions in the yarn form come from these lists. Renaming here does not change your yarns.</p>
      {error && <ErrorBox error={error} />}

      <section aria-labelledby="lists-yarns" className="flex flex-col gap-2">
        <h2 id="lists-yarns" className={h2}>Yarns</h2>
        {brands.map((brand) => (
          <div key={brand} className="flex flex-col gap-1">
            <h3 className="text-lg text-stash">{brand}</h3>
            <ul className="rounded-2xl border border-line bg-surface">
              {(catalog.data ?? []).filter((c) => c.brand === brand).map((c) => (
                row({ table: 'catalog_yarns', id: c.id, label: c.name },
                  [c.name, weightLabel(c.yarn_weight), c.fiber].filter(Boolean).join(' · '))
              ))}
            </ul>
          </div>
        ))}
        <PasteBox label="yarns" hint="One per line: Brand ; Yarn name ; Weight ; Fiber"
          parse={(text) => { const r = parseYarnList(text); return { payload: { yarns: r.entries }, rejected: r.rejected }; }} />
      </section>

      <section aria-labelledby="lists-shops" className="flex flex-col gap-2">
        <h2 id="lists-shops" className={h2}>Shops</h2>
        <ul className="rounded-2xl border border-line bg-surface">
          {(shops.data ?? []).map((s) => row({ table: 'shops', id: s.id, label: s.name }, s.name))}
        </ul>
        <PasteBox label="shops" hint="One shop per line"
          parse={(text) => ({ payload: { shops: parseNameList(text) }, rejected: [] })} />
      </section>

      <section aria-labelledby="lists-fibers" className="flex flex-col gap-2">
        <h2 id="lists-fibers" className={h2}>Fibers</h2>
        <ul className="rounded-2xl border border-line bg-surface">
          {(fibers.data ?? []).map((f) => row({ table: 'fibers', id: f.id, label: f.name }, f.name))}
        </ul>
        <PasteBox label="fibers" hint="One fiber per line"
          parse={(text) => ({ payload: { fibers: parseNameList(text) }, rejected: [] })} />
      </section>

      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing?.label ?? ''}?`}
        message="It is no longer suggested. Yarns that use it keep it."
        confirmLabel="Remove"
        onCancel={() => setRemoving(null)}
        onConfirm={() => { if (removing) remove.mutate({ table: removing.table, id: removing.id }); setRemoving(null); }}
      />
    </div>
  );
}

type Payload = Parameters<ReturnType<typeof useImportLists>['mutate']>[0];

function PasteBox({ label, hint, parse }: { label: string; hint: string; parse: (text: string) => { payload: Payload; rejected: number[] } }) {
  const importLists = useImportLists();
  const [text, setText] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-1.5 text-sm text-muted">
        {`Paste ${label}`}
        <textarea rows={3} value={text} placeholder={hint} onChange={(e) => setText(e.target.value)}
          className="rounded-xl border border-line bg-surface p-3 text-ink" />
      </label>
      <button type="button" disabled={importLists.isPending || text.trim() === ''}
        className="h-11 self-start rounded-full bg-stash px-5 text-white"
        onClick={() => {
          const { payload, rejected } = parse(text);
          importLists.mutate(payload, {
            onSuccess: (r) => { setSummary(importSummary(r, rejected)); setText(''); },
          });
        }}>{`Import ${label}`}</button>
      {importLists.error && <ErrorBox error={importLists.error} />}
      {summary && <p role="status" className="text-sm text-stash-dark">{summary}</p>}
    </div>
  );
}
