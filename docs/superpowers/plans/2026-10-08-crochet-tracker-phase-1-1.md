# Crochet Tracker Phase 1.1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-part pattern instructions (PDF pages or photos) shown on the part page, pattern result photos, "+ Add skeins", clearer photo fields, re-typable number fields, removal of planned yarns, and a timer button on the part page.

**Architecture:** One new migration adds `part_instructions`, the `parts.pattern_part_id` link (with a name-based backfill), pattern photo / PDF-change columns, `add_skeins`, and two private buckets. PDF pages are rendered in the browser with `pdfjs-dist` into JPEGs at the moment they are added, so on the part page photos and pages are the same thing: a list of images. Shared `NumberField` and `PhotoField` components replace the ad-hoc inputs.

**Tech Stack:** existing Phase 1 stack (React 19, Vite 6, TypeScript, Tailwind 4, TanStack Query 5, Supabase, Vitest, Playwright) + `pdfjs-dist`.

**Spec:** `docs/superpowers/specs/2026-10-08-crochet-tracker-phase-1-1-design.md` (builds on `docs/superpowers/specs/2026-09-24-crochet-tracker-design.md`).

## Global Constraints

- Everything from the Phase 1 plan's Global Constraints still holds: RLS "owner only" on every table; colors only through Tailwind theme tokens (`bg`, `surface`, `line`, `divider`, `ink`, `muted`, `projects*`, `patterns*`, `stash*`, `timer*`, `row`, `row-ink`, `sun*`); font Indie Flower; touch targets ≥ 44 px (`h-11`/`w-11`/`min-h-11`); failed requests show a message (`ErrorBox`); deletes are always confirmed (`ConfirmDialog`).
- Every mutation invalidates through `useInvalidateAll()` (`src/lib/invalidate.ts`), which gains the `'instructions'` key.
- Images (photos and rendered PDF pages): 1600 px long edge (`resizeImage` already does this for photos; PDF pages are rendered at 1600 px width), JPEG quality 0.8.
- New private buckets `pattern-instructions` and `pattern-photos`: JPEG, ≤ 5 MB, objects under `<user_id>/…`.
- `part_instructions.kind` is `pdf_page` or `photo`; `pdf_page` is required and ≥ 1 for `pdf_page`, null for `photo`.
- Database tests run only against the local Supabase stack (`npm run db:start`, API http://127.0.0.1:55421, `.env.test`). Never run `npm run db:push` during tasks; never read or stage `.env` / `.env.test`.
- Dev server port 7420, e2e port 7421.

## Commands

- Unit/component tests: `npm test` · Database tests: `npm run test:db` · Re-apply migrations locally: `npm run db:reset` · Regenerate types: `npm run db:types` · Build: `npm run build` · End-to-end: `npm run e2e`

## File Structure (new and changed)

```
supabase/migrations/20261008000001_phase_1_1.sql   all schema changes of this phase
supabase/tests/phase_1_1.test.ts                    database tests for it
src/components/NumberField.tsx (+ test)             re-typable number input
src/components/PhotoField.tsx (+ test)              "Take or choose a photo" with preview / remove
src/lib/invalidate.ts                               + 'instructions'
src/lib/storage.ts                                  + 'pattern-instructions' | 'pattern-photos' buckets
src/features/stash/api.ts, YarnPage.tsx, YarnForm.tsx      add skeins, PhotoField, NumberField
src/features/projects/api.ts, ProjectPage.tsx      remove a planned yarn, NumberField
src/features/patterns/logic.ts, api.ts             part ids kept on save (planPartChanges)
src/features/patterns/PatternForm.tsx              result photo, NumberField, confirm part removal
src/features/patterns/PatternList.tsx, PatternPage.tsx, ../projects/NewProject.tsx   result photo, Instructions buttons
src/features/instructions/pageRanges.ts (+ test)   "3, 5-6" parser
src/features/instructions/pdf.ts                   pdfjs-dist loading + page rendering
src/features/instructions/api.ts                   queries and mutations
src/features/instructions/PartInstructionsPage.tsx (+ test)   /patterns/:id/parts/:partId
src/features/instructions/InstructionViewer.tsx (+ test)      full-screen viewer
src/features/timer/PartTimerButton.tsx (+ test)    large start/stop button for the part page
src/features/parts/PartPage.tsx (+ test)           new order, timer, instructions
src/features/parts/SessionForm.tsx, YarnUsageForm.tsx, RowCounter.tsx   NumberField
e2e/fixtures/one-page.pdf, e2e/main-flow.spec.ts   e2e extension
```

---

### Task 1: NumberField component, used for every number input

**Files:**
- Create: `src/components/NumberField.tsx`, `src/components/NumberField.test.tsx`
- Modify: `src/features/patterns/PatternForm.tsx` (How many, Rows), `src/features/stash/YarnForm.tsx` (Skeins owned, Price per skein), `src/features/projects/ProjectPage.tsx` (plan Skeins), `src/features/parts/YarnUsageForm.tsx` (Skeins used), `src/features/parts/SessionForm.tsx` (Duration (minutes))
- Leave `src/features/parts/RowCounter.tsx` as is (its typed input already keeps a string draft).

**Interfaces:**
- Produces: `NumberField(props: { value: number | null; onChange: (v: number | null) => void; emptyValue?: number | null; min?: number; step?: number; 'aria-label'?: string; id?: string; required?: boolean; className?: string })`.
  - Keeps the typed text while focused; selects all text on focus; an empty field is allowed while typing.
  - Commits on blur and on Enter: empty → `emptyValue` (default `null`); not a number → previous value restored; below `min` → `min`; otherwise the number.
  - Also calls `onChange` while typing whenever the text is a valid number ≥ `min`, so forms that save on submit see the latest value.
  - When the `value` prop changes while not focused, the text follows it.

- [ ] **Step 1: Write the failing tests — `src/components/NumberField.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import NumberField from './NumberField';

function Harness({ initial, emptyValue, min }: { initial: number | null; emptyValue?: number | null; min?: number }) {
  const [v, setV] = useState<number | null>(initial);
  return (
    <>
      <NumberField aria-label="Qty" value={v} onChange={setV} emptyValue={emptyValue} min={min} />
      <output aria-label="value">{v === null ? 'null' : String(v)}</output>
    </>
  );
}

test('typing replaces the selected value instead of appending to it', async () => {
  render(<Harness initial={1} min={1} emptyValue={1} />);
  const input = screen.getByLabelText('Qty');
  await userEvent.tab();
  await userEvent.keyboard('2');
  expect(input).toHaveValue('2');
  expect(screen.getByLabelText('value')).toHaveTextContent('2');
});

test('the field can be emptied while typing; leaving it empty restores emptyValue', async () => {
  render(<Harness initial={4} min={1} emptyValue={1} />);
  const input = screen.getByLabelText('Qty');
  await userEvent.clear(input);
  expect(input).toHaveValue('');
  await userEvent.tab();
  expect(input).toHaveValue('1');
  expect(screen.getByLabelText('value')).toHaveTextContent('1');
});

test('an optional field left empty becomes null', async () => {
  render(<Harness initial={18} min={1} />);
  const input = screen.getByLabelText('Qty');
  await userEvent.clear(input);
  await userEvent.tab();
  expect(input).toHaveValue('');
  expect(screen.getByLabelText('value')).toHaveTextContent('null');
});

test('a value can be corrected after it was raised', async () => {
  render(<Harness initial={null} min={1} />);
  const input = screen.getByLabelText('Qty');
  await userEvent.type(input, '18');
  await userEvent.tab();
  await userEvent.tab();
  expect(input).toHaveFocus();
  await userEvent.keyboard('24{Enter}');
  expect(screen.getByLabelText('value')).toHaveTextContent('24');
});

test('values below min are raised to min on commit', async () => {
  render(<Harness initial={2} min={1} emptyValue={1} />);
  await userEvent.tab();
  await userEvent.keyboard('0');
  await userEvent.tab();
  expect(screen.getByLabelText('value')).toHaveTextContent('1');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/components/NumberField.test.tsx`
Expected: FAIL — `Failed to resolve import "./NumberField"`.

- [ ] **Step 3: Implement `src/components/NumberField.tsx`**

```tsx
import { useEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type MouseEvent } from 'react';

type Props = {
  value: number | null;
  onChange: (v: number | null) => void;
  emptyValue?: number | null;
  min?: number;
  step?: number;
  'aria-label'?: string;
  id?: string;
  required?: boolean;
  className?: string;
};

const show = (v: number | null) => (v === null ? '' : String(v));

/**
 * A number input that can be emptied and re-typed: the text is kept while editing,
 * selected on focus, and committed on blur / Enter.
 */
export default function NumberField({ value, onChange, emptyValue = null, min, step, className, ...rest }: Props) {
  const [text, setText] = useState(show(value));
  const [focused, setFocused] = useState(false);
  // Browsers clear a focus-time select() on the mouseup of the same click; keep the selection.
  const justFocused = useRef(false);

  useEffect(() => {
    if (!focused) setText(show(value));
  }, [value, focused]);

  const parse = (t: string): number | null | 'invalid' => {
    if (t.trim() === '') return null;
    const n = Number(t.replace(',', '.'));
    return Number.isFinite(n) ? n : 'invalid';
  };

  function commit() {
    const parsed = parse(text);
    let next: number | null;
    if (parsed === 'invalid') next = value;
    else if (parsed === null) next = emptyValue;
    else next = min !== undefined && parsed < min ? min : parsed;
    setText(show(next));
    if (next !== value) onChange(next);
  }

  function change(t: string) {
    setText(t);
    const parsed = parse(t);
    if (typeof parsed === 'number' && (min === undefined || parsed >= min)) onChange(parsed);
  }

  return (
    <input
      {...rest}
      type="text"
      inputMode={step !== undefined && step < 1 ? 'decimal' : 'numeric'}
      value={text}
      onFocus={(e: FocusEvent<HTMLInputElement>) => { setFocused(true); justFocused.current = true; e.currentTarget.select(); }}
      onMouseUp={(e: MouseEvent<HTMLInputElement>) => { if (justFocused.current) { e.preventDefault(); justFocused.current = false; } }}
      onChange={(e) => { justFocused.current = false; change(e.target.value); }}
      onBlur={() => { setFocused(false); justFocused.current = false; commit(); }}
      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
      className={className}
    />
  );
}
```

Note: `type="text"` with `inputMode` gives the numeric keyboard on phones while letting the field be truly empty (browsers' `type="number"` reports an empty string for partial input and fights re-typing).

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- src/components/NumberField.test.tsx` — Expected: PASS.

- [ ] **Step 5: Replace the number inputs**

`src/features/patterns/PatternForm.tsx` — replace the two inputs in the parts row:
```tsx
          <NumberField aria-label="How many" value={part.count} min={1} emptyValue={1}
            onChange={(v) => setPart(i, { count: v ?? 1 })}
            className="h-11 w-12 rounded-xl border border-line bg-surface text-center" />
          <NumberField aria-label="Rows" value={part.total_rows} min={1}
            onChange={(v) => setPart(i, { total_rows: v })}
            className="h-11 w-14 rounded-xl border border-line bg-surface text-center" />
```

`src/features/stash/YarnForm.tsx`:
```tsx
      <label className={label}>Skeins owned
        <NumberField required value={y.skeins_owned} min={0} step={0.25} emptyValue={0}
          onChange={(v) => set('skeins_owned', v ?? 0)} className={input} />
      </label>
```
```tsx
        <label className={`${label} flex-1`}>Price per skein (€)
          <NumberField value={y.price_per_skein} min={0} step={0.01}
            onChange={(v) => set('price_per_skein', v)} className={input} />
        </label>
```

`src/features/projects/ProjectPage.tsx` (plan form):
```tsx
          <label className="flex w-24 flex-col gap-1 text-sm text-muted">Skeins
            <NumberField value={plan.skeins} min={0} step={0.25} emptyValue={0}
              onChange={(v) => setPlan({ ...plan, skeins: v ?? 0 })}
              className="h-11 rounded-xl border border-line px-2 text-ink" />
          </label>
```

`src/features/parts/YarnUsageForm.tsx`: change the `skeins` state to `useState<number | null>(0.25)`, replace the input with
```tsx
        <NumberField value={skeins} min={0} step={0.05}
          onChange={setSkeins} className="h-11 rounded-xl border border-line px-2 text-ink" />
```
and in `submit` use `if (yarnId && skeins !== null && skeins > 0) onSave({ yarnId, skeins });`.

`src/features/parts/SessionForm.tsx`: change `minutes` state to `useState<number | null>(initial?.minutes ?? 30)`, replace the input with
```tsx
        <NumberField value={minutes} min={0} onChange={setMinutes}
          className="h-11 rounded-xl border border-line px-2 text-ink" />
```
and in `submit` use `const m = minutes ?? 0;` (the existing "at least 1 minute" check stays).

Add `import NumberField from '../../components/NumberField';` (or `'../components/NumberField'` per file depth) to each file.

Existing tests that used `userEvent.clear` + `type` on these fields keep working (a label wraps each field, so `getByLabelText` still resolves; `toHaveValue` now returns strings — update any assertion that expected a number, e.g. `toHaveValue(25)` → `toHaveValue('25')`).

- [ ] **Step 6: Run the whole suite and the build**

Run: `npm test` then `npm run build` — Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat: re-typable number fields everywhere"
```

---

### Task 2: PhotoField component and a clearer yarn photo field

**Files:**
- Create: `src/components/PhotoField.tsx`, `src/components/PhotoField.test.tsx`
- Modify: `src/features/stash/YarnForm.tsx`, `src/features/stash/YarnForm.test.tsx` (only if an existing test used the old "Photo" input)

**Interfaces:**
- Consumes: `useSignedUrl(bucket, path)`, `type Bucket` from `src/lib/storage.ts`.
- Produces: `PhotoField(props: { label: string; bucket: Bucket; path: string | null; file: File | null; onFile: (f: File | null) => void; onRemove: () => void })` — shows a 96 px preview (the new file via `URL.createObjectURL`, else the stored photo via a signed URL, else a soft placeholder), a button-styled file picker "Take or choose a photo" (label text exactly that, `accept="image/*"`), and "Remove photo" when there is a photo or a file. Removing clears the file and calls `onRemove`. Upload stays the form's job.

- [ ] **Step 1: Write the failing tests — `src/components/PhotoField.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PhotoField from './PhotoField';

vi.mock('../lib/storage', () => ({ useSignedUrl: (_b: string, p: string | null) => (p ? `https://signed/${p}` : undefined) }));
beforeAll(() => { URL.createObjectURL = vi.fn(() => 'blob:preview'); URL.revokeObjectURL = vi.fn(); });

test('shows the stored photo and can remove it', async () => {
  const onRemove = vi.fn();
  render(<PhotoField label="Photo" bucket="yarn-photos" path="u/a.jpg" file={null} onFile={vi.fn()} onRemove={onRemove} />);
  expect(screen.getByRole('img', { name: 'Photo preview' })).toHaveAttribute('src', 'https://signed/u/a.jpg');
  await userEvent.click(screen.getByRole('button', { name: 'Remove photo' }));
  expect(onRemove).toHaveBeenCalled();
});

test('picking a file reports it and previews it', async () => {
  const onFile = vi.fn();
  const { rerender } = render(<PhotoField label="Photo" bucket="yarn-photos" path={null} file={null} onFile={onFile} onRemove={vi.fn()} />);
  expect(screen.queryByRole('button', { name: 'Remove photo' })).toBeNull();
  const file = new File(['x'], 'skein.jpg', { type: 'image/jpeg' });
  await userEvent.upload(screen.getByLabelText('Take or choose a photo'), file);
  expect(onFile).toHaveBeenCalledWith(file);
  rerender(<PhotoField label="Photo" bucket="yarn-photos" path={null} file={file} onFile={onFile} onRemove={vi.fn()} />);
  expect(screen.getByRole('img', { name: 'Photo preview' })).toHaveAttribute('src', 'blob:preview');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/components/PhotoField.test.tsx` — Expected: FAIL (`./PhotoField` unresolved).

- [ ] **Step 3: Implement `src/components/PhotoField.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useSignedUrl, type Bucket } from '../lib/storage';

type Props = {
  label: string;
  bucket: Bucket;
  path: string | null;
  file: File | null;
  onFile: (f: File | null) => void;
  onRemove: () => void;
};

export default function PhotoField({ label, bucket, path, file, onFile, onRemove }: Props) {
  const stored = useSignedUrl(bucket, file ? null : path);
  const [local, setLocal] = useState<string | null>(null);

  useEffect(() => {
    if (!file) { setLocal(null); return; }
    const url = URL.createObjectURL(file);
    setLocal(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const preview = local ?? stored ?? null;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm text-muted">{label}</span>
      <div className="flex items-center gap-3">
        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-divider">
          {preview && <img src={preview} alt="Photo preview" className="h-full w-full object-cover" />}
        </div>
        <div className="flex flex-col gap-2">
          <label className="flex min-h-11 cursor-pointer items-center rounded-full border-[1.5px] border-dashed border-muted bg-surface px-4 text-sm">
            Take or choose a photo
            <input type="file" accept="image/*" className="sr-only" aria-label="Take or choose a photo"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
          </label>
          {(file || path) && (
            <button type="button" onClick={() => { onFile(null); onRemove(); }} className="min-h-11 self-start text-sm text-muted">
              Remove photo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- src/components/PhotoField.test.tsx` — Expected: PASS.

- [ ] **Step 5: Use it in the yarn form**

In `src/features/stash/YarnForm.tsx` replace the `<label className={label}>Photo<input type="file" …/></label>` line with:
```tsx
      <PhotoField label="Photo" bucket="yarn-photos" path={y.photo_path} file={photo}
        onFile={setPhoto} onRemove={() => set('photo_path', null)} />
```
and import `PhotoField from '../../components/PhotoField'`. If `YarnForm.test.tsx` uploads through `getByLabelText('Photo')`, change it to `getByLabelText('Take or choose a photo')`, and add `vi.mock` coverage for `useSignedUrl` in that test's existing `../../lib/storage` mock (`useSignedUrl: () => undefined`).

- [ ] **Step 6: Run the suite and the build**

Run: `npm test` then `npm run build` — Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src
git commit -m "feat: clearer photo field with preview and remove"
```

---

### Task 3: Database — instructions table, part link, pattern photo, add_skeins, buckets

**Files:**
- Create: `supabase/migrations/20261008000001_phase_1_1.sql`, `supabase/tests/phase_1_1.test.ts`
- Modify: `src/lib/database.types.ts` (regenerated), `src/lib/storage.ts` (Bucket type), `src/lib/invalidate.ts` (+ `'instructions'`)

**Interfaces:**
- Produces (database):
  - table `part_instructions(id, user_id, pattern_part_id, position, kind, pdf_page, image_path, created_at, updated_at)`
  - `patterns.photo_path text`, `patterns.pdf_updated_at timestamptz` (trigger-maintained)
  - `parts.pattern_part_id uuid` (on delete set null), backfilled by name
  - `start_project_from_pattern` also sets `parts.pattern_part_id`
  - RPC `add_skeins({ p_yarn_id: string, p_amount: number }): void`
  - buckets `pattern-instructions`, `pattern-photos`
- Produces (TS): `type Bucket = 'pattern-pdfs' | 'project-photos' | 'yarn-photos' | 'pattern-instructions' | 'pattern-photos'`; `useInvalidateAll` also invalidates `['instructions']`.

**Before starting:** the local stack must be running (`npm run db:start`; API http://127.0.0.1:55421).

- [ ] **Step 1: Write the failing database tests — `supabase/tests/phase_1_1.test.ts`**

```ts
import { admin, createTestUser, deleteTestUser, type TestUser } from './helpers';

let u: TestUser;
let other: TestUser;
beforeAll(async () => {
  u = await createTestUser();
  other = await createTestUser();
});
afterAll(async () => {
  await deleteTestUser(u);
  await deleteTestUser(other);
});

async function legPattern(client = u.client) {
  const { data: pattern, error } = await client.from('patterns').insert({ name: 'T-rex' }).select().single();
  if (error) throw error;
  const { data: parts, error: e2 } = await client.from('pattern_parts').insert([
    { pattern_id: pattern.id, name: 'Head', position: 0, count: 1 },
    { pattern_id: pattern.id, name: 'Leg', position: 1, count: 2 },
  ]).select().order('position');
  if (e2) throw e2;
  return { pattern, head: parts[0], leg: parts[1] };
}

describe('part_instructions', () => {
  test('owner can add a pdf page and a photo; constraints are enforced', async () => {
    const { leg } = await legPattern();
    const ok = await u.client.from('part_instructions').insert([
      { pattern_part_id: leg.id, position: 0, kind: 'pdf_page', pdf_page: 3, image_path: `${u.id}/a.jpg` },
      { pattern_part_id: leg.id, position: 1, kind: 'photo', image_path: `${u.id}/b.jpg` },
    ]);
    expect(ok.error).toBeNull();

    const noPage = await u.client.from('part_instructions')
      .insert({ pattern_part_id: leg.id, position: 2, kind: 'pdf_page', image_path: 'x.jpg' });
    expect(noPage.error).not.toBeNull();
    const photoWithPage = await u.client.from('part_instructions')
      .insert({ pattern_part_id: leg.id, position: 2, kind: 'photo', pdf_page: 1, image_path: 'x.jpg' });
    expect(photoWithPage.error).not.toBeNull();
    const badKind = await u.client.from('part_instructions')
      .insert({ pattern_part_id: leg.id, position: 2, kind: 'video', image_path: 'x.jpg' });
    expect(badKind.error).not.toBeNull();
  });

  test('other users cannot see them', async () => {
    const { leg } = await legPattern();
    await u.client.from('part_instructions')
      .insert({ pattern_part_id: leg.id, position: 0, kind: 'photo', image_path: `${u.id}/c.jpg` });
    const { data } = await other.client.from('part_instructions').select().eq('pattern_part_id', leg.id);
    expect(data).toEqual([]);
  });

  test('deleting a pattern part deletes its instructions', async () => {
    const { head } = await legPattern();
    await u.client.from('part_instructions')
      .insert({ pattern_part_id: head.id, position: 0, kind: 'photo', image_path: `${u.id}/d.jpg` });
    await u.client.from('pattern_parts').delete().eq('id', head.id);
    const { data } = await u.client.from('part_instructions').select().eq('pattern_part_id', head.id);
    expect(data).toEqual([]);
  });
});

test('start_project_from_pattern links each copied part to its pattern part', async () => {
  const { pattern, head, leg } = await legPattern();
  const { data: projectId, error } = await u.client.rpc('start_project_from_pattern', { p_pattern_id: pattern.id });
  expect(error).toBeNull();
  const { data: parts } = await u.client.from('parts').select('name, pattern_part_id').eq('project_id', projectId).order('position');
  expect(parts).toEqual([
    { name: 'Head', pattern_part_id: head.id },
    { name: 'Leg 1', pattern_part_id: leg.id },
    { name: 'Leg 2', pattern_part_id: leg.id },
  ]);
});

test('backfill rule: an unlinked part named "Leg 2" links to "Leg" (run through the SQL helper)', async () => {
  const { pattern, leg } = await legPattern();
  const { data: project } = await u.client.from('projects').insert({ name: 'Old', pattern_id: pattern.id }).select().single();
  const { data: part } = await u.client.from('parts')
    .insert({ project_id: project!.id, name: 'Leg 2', position: 0 }).select().single();
  // The migration's backfill is also exposed as a function so it can be re-run safely.
  const { error } = await admin.rpc('backfill_part_links');
  expect(error).toBeNull();
  const { data } = await u.client.from('parts').select('pattern_part_id').eq('id', part!.id).single();
  expect(data!.pattern_part_id).toBe(leg.id);
});

describe('patterns', () => {
  test('photo_path is stored; pdf_updated_at changes only when pdf_path changes', async () => {
    const { data: p } = await u.client.from('patterns')
      .insert({ name: 'Bag', photo_path: `${u.id}/bag.jpg`, pdf_path: `${u.id}/bag.pdf` }).select().single();
    expect(p!.photo_path).toBe(`${u.id}/bag.jpg`);
    const first = p!.pdf_updated_at;
    expect(first).not.toBeNull();

    await new Promise((r) => setTimeout(r, 50));
    const { data: renamed } = await u.client.from('patterns').update({ name: 'Bag A' }).eq('id', p!.id).select().single();
    expect(renamed!.pdf_updated_at).toBe(first);

    await new Promise((r) => setTimeout(r, 50));
    const { data: replaced } = await u.client.from('patterns')
      .update({ pdf_path: `${u.id}/bag-v2.pdf` }).eq('id', p!.id).select().single();
    expect(new Date(replaced!.pdf_updated_at!).getTime()).toBeGreaterThan(new Date(first!).getTime());
  });
});

describe('add_skeins', () => {
  test('adds to skeins_owned and rejects amounts ≤ 0', async () => {
    const { data: y } = await u.client.from('yarns').insert({ name: 'Fern', skeins_owned: 3 }).select().single();
    expect((await u.client.rpc('add_skeins', { p_yarn_id: y!.id, p_amount: 2 })).error).toBeNull();
    expect((await u.client.rpc('add_skeins', { p_yarn_id: y!.id, p_amount: 0.25 })).error).toBeNull();
    const { data } = await u.client.from('yarns').select('skeins_owned').eq('id', y!.id).single();
    expect(Number(data!.skeins_owned)).toBe(5.25);
    expect((await u.client.rpc('add_skeins', { p_yarn_id: y!.id, p_amount: 0 })).error).not.toBeNull();
  });

  test('cannot add to someone else yarn', async () => {
    const { data: y } = await u.client.from('yarns').insert({ name: 'Mine', skeins_owned: 1 }).select().single();
    await other.client.rpc('add_skeins', { p_yarn_id: y!.id, p_amount: 5 });
    const { data } = await u.client.from('yarns').select('skeins_owned').eq('id', y!.id).single();
    expect(Number(data!.skeins_owned)).toBe(1);
  });
});

describe('new buckets', () => {
  const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' });
  afterAll(async () => {
    await u.client.storage.from('pattern-instructions').remove([`${u.id}/p.jpg`]);
    await u.client.storage.from('pattern-photos').remove([`${u.id}/r.jpg`]);
  });
  test('own-folder JPEG uploads work, other folders are refused', async () => {
    expect((await u.client.storage.from('pattern-instructions').upload(`${u.id}/p.jpg`, jpeg, { contentType: 'image/jpeg' })).error).toBeNull();
    expect((await u.client.storage.from('pattern-photos').upload(`${u.id}/r.jpg`, jpeg, { contentType: 'image/jpeg' })).error).toBeNull();
    expect((await other.client.storage.from('pattern-instructions').upload(`${u.id}/x.jpg`, jpeg, { contentType: 'image/jpeg' })).error).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:db -- supabase/tests/phase_1_1.test.ts`
Expected: FAIL — `relation "public.part_instructions" does not exist` (and similar).

- [ ] **Step 3: Write `supabase/migrations/20261008000001_phase_1_1.sql`**

```sql
-- Phase 1.1: per-part instructions, pattern photo, part → pattern-part link, add_skeins, new buckets.

-- Patterns: result photo + when the PDF last changed
alter table public.patterns add column photo_path text;
alter table public.patterns add column pdf_updated_at timestamptz;

create function public.set_pdf_updated_at() returns trigger
language plpgsql as $$
begin
  if (tg_op = 'INSERT' and new.pdf_path is not null)
     or (tg_op = 'UPDATE' and new.pdf_path is distinct from old.pdf_path) then
    new.pdf_updated_at := now();
  end if;
  return new;
end $$;

create trigger set_pdf_updated_at before insert or update on public.patterns
  for each row execute function public.set_pdf_updated_at();

update public.patterns set pdf_updated_at = updated_at where pdf_path is not null;

-- Instructions of a pattern part: rendered PDF pages or photos, as images
create table public.part_instructions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  pattern_part_id uuid not null references public.pattern_parts on delete cascade,
  position int not null default 0,
  kind text not null check (kind in ('pdf_page', 'photo')),
  pdf_page int,
  image_path text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'pdf_page' and pdf_page is not null and pdf_page >= 1) or (kind = 'photo' and pdf_page is null))
);
create index on public.part_instructions (pattern_part_id);

alter table public.part_instructions enable row level security;
create policy owner_all on public.part_instructions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger set_updated_at before update on public.part_instructions
  for each row execute function public.set_updated_at();

-- Project parts remember the template part they were copied from
alter table public.parts add column pattern_part_id uuid references public.pattern_parts on delete set null;
create index on public.parts (pattern_part_id);

-- Link existing project parts by name: "Leg" → "Leg"; "Leg 2" → "Leg" when that part has count > 1.
-- Security definer so the migration (and tests) can run it across users; it only touches rows whose
-- part, project and pattern part all belong to the same user.
create function public.backfill_part_links() returns void
language sql security definer set search_path = public as $$
  update public.parts pt
  set pattern_part_id = pp.id
  from public.projects pr, public.pattern_parts pp
  where pt.pattern_part_id is null
    and pt.project_id = pr.id
    and pr.pattern_id is not null
    and pp.pattern_id = pr.pattern_id
    and pp.user_id = pt.user_id
    and (
      pt.name = pp.name
      or (pp.count > 1
          and left(pt.name, length(pp.name) + 1) = pp.name || ' '
          and substring(pt.name from length(pp.name) + 2) ~ '^[0-9]+$')
    );
$$;
revoke execute on function public.backfill_part_links() from public, anon, authenticated;

select public.backfill_part_links();

-- start_project_from_pattern: same as 20260924000005 plus pattern_part_id on each copied part
create or replace function public.start_project_from_pattern(p_pattern_id uuid) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_pattern public.patterns%rowtype;
  v_project uuid;
  v_part record;
  v_pos int := 0;
begin
  select * into v_pattern from public.patterns where id = p_pattern_id;
  if not found then
    raise exception 'pattern % not found', p_pattern_id using errcode = 'P0002';
  end if;

  insert into public.projects (name, pattern_id, status, start_date, hook_size_mm)
  values (v_pattern.name, v_pattern.id, 'in_progress', current_date, v_pattern.hook_size_mm)
  returning id into v_project;

  for v_part in
    select id, name, count, total_rows from public.pattern_parts
    where pattern_id = p_pattern_id order by position, created_at
  loop
    for i in 1..v_part.count loop
      insert into public.parts (project_id, name, position, total_rows, pattern_part_id)
      values (
        v_project,
        case when v_part.count = 1 then v_part.name else v_part.name || ' ' || i end,
        v_pos,
        v_part.total_rows,
        v_part.id
      );
      v_pos := v_pos + 1;
    end loop;
  end loop;

  if v_pos = 0 then
    insert into public.parts (project_id, name, position) values (v_project, 'Main', 0);
  end if;

  return v_project;
end $$;

-- Add skeins to a yarn in one statement (no lost update between two quick additions)
create function public.add_skeins(p_yarn_id uuid, p_amount numeric) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be greater than 0' using errcode = '22023';
  end if;
  update public.yarns set skeins_owned = skeins_owned + p_amount where id = p_yarn_id;
end $$;

-- New private buckets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('pattern-instructions', 'pattern-instructions', false, 5242880, array['image/jpeg']),
  ('pattern-photos', 'pattern-photos', false, 5242880, array['image/jpeg']);

drop policy "own folder read" on storage.objects;
drop policy "own folder insert" on storage.objects;
drop policy "own folder update" on storage.objects;
drop policy "own folder delete" on storage.objects;

create policy "own folder read" on storage.objects for select to authenticated
  using (bucket_id in ('pattern-pdfs', 'project-photos', 'yarn-photos', 'pattern-instructions', 'pattern-photos')
         and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own folder insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('pattern-pdfs', 'project-photos', 'yarn-photos', 'pattern-instructions', 'pattern-photos')
              and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own folder update" on storage.objects for update to authenticated
  using (bucket_id in ('pattern-pdfs', 'project-photos', 'yarn-photos', 'pattern-instructions', 'pattern-photos')
         and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own folder delete" on storage.objects for delete to authenticated
  using (bucket_id in ('pattern-pdfs', 'project-photos', 'yarn-photos', 'pattern-instructions', 'pattern-photos')
         and (storage.foldername(name))[1] = auth.uid()::text);
```

Note on the backfill test: `backfill_part_links()` has execute revoked from API roles, so the test calls it with the `admin` (service-role) client, which keeps the privilege.

- [ ] **Step 4: Apply locally and run all database tests**

Run: `npm run db:reset` then `npm run test:db`
Expected: PASS — the new file and all Phase 1 database tests (31 + the new ones).

- [ ] **Step 5: Regenerate types and update the TS helpers**

Run: `npm run db:types` (expect `part_instructions`, `photo_path`, `pdf_updated_at`, `pattern_part_id`, `add_skeins` in the output file).

`src/lib/storage.ts`:
```ts
export type Bucket = 'pattern-pdfs' | 'project-photos' | 'yarn-photos' | 'pattern-instructions' | 'pattern-photos';
```

`src/lib/invalidate.ts`:
```ts
const ROOT_KEYS = ['projects', 'parts', 'timer', 'yarns', 'patterns', 'pattern-types', 'instructions'] as const;
```
If `src/lib/invalidate.test.ts` asserts the list of keys, add `'instructions'` there.

Run: `npm test` and `npm run build` — Expected: PASS. (Any form building a full `patterns` insert object — `PatternForm`'s `toInput` — now needs `photo_path` and `pdf_updated_at`; for `pdf_updated_at`, exclude it from `PatternInput`: change the type to `Omit<Pattern, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'pdf_updated_at'> & { id?: string }` and add `photo_path` to both branches of `toInput`: `photo_path: null` for a new pattern, `photo_path: p.photo_path` for an existing one.)

- [ ] **Step 6: Commit**

```bash
git add supabase src/lib
git commit -m "feat: database for part instructions, pattern photos, add_skeins and new buckets"
```

---

### Task 4: "+ Add skeins" on the yarn page

**Files:**
- Modify: `src/features/stash/api.ts`, `src/features/stash/YarnPage.tsx`, `src/features/stash/YarnPage.test.tsx`

**Interfaces:**
- Consumes: RPC `add_skeins` (Task 3), `NumberField` (Task 1), `useInvalidateAll`.
- Produces: `useAddSkeins()` — mutation `({ yarnId: string; amount: number }) => void`.

- [ ] **Step 1: Write the failing test (append to `src/features/stash/YarnPage.test.tsx`)**

Add `useAddSkeins: () => ({ mutate: addSkeins, isPending: false, error: null })` to the file's existing `vi.mock('./api', …)` factory (declare `const addSkeins = vi.fn();` next to the other spies, above the mock), then add:

```tsx
test('+ Add skeins adds the typed amount without opening the form', async () => {
  renderWithProviders(<YarnPage />, { route: '/stash/y1', path: '/stash/:id' });
  await userEvent.click(screen.getByRole('button', { name: '+ Add skeins' }));
  const amount = screen.getByLabelText('How many skeins?');
  expect(amount).toHaveValue('1');
  await userEvent.clear(amount);
  await userEvent.type(amount, '2');
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));
  expect(addSkeins).toHaveBeenCalledWith({ yarnId: 'y1', amount: 2 }, expect.anything());
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/features/stash/YarnPage.test.tsx`
Expected: FAIL — no button named "+ Add skeins".

- [ ] **Step 3: Implement**

`src/features/stash/api.ts` — add:
```ts
export function useAddSkeins() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async ({ yarnId, amount }: { yarnId: string; amount: number }) => {
      const { error } = await supabase.rpc('add_skeins', { p_yarn_id: yarnId, p_amount: amount });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
```

`src/features/stash/YarnPage.tsx`:
- import `NumberField from '../../components/NumberField'` and `useAddSkeins` from `./api`;
- state: `const addSkeins = useAddSkeins();` and `const [adding, setAdding] = useState<number | null | undefined>(undefined);` (`undefined` = closed);
- right after the stats grid (before the "More used than owned" warning), insert:

```tsx
        {adding === undefined ? (
          <button type="button" onClick={() => setAdding(1)}
            className="min-h-11 self-start rounded-full bg-stash px-5 text-white">+ Add skeins</button>
        ) : (
          <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface p-3">
            <label className="flex w-32 flex-col gap-1 text-sm text-muted">How many skeins?
              <NumberField value={adding} min={0} step={0.25} onChange={setAdding}
                className="h-11 rounded-xl border border-line px-2 text-ink" />
            </label>
            <button type="button" onClick={() => setAdding(undefined)} className="h-11 px-3 text-muted">Cancel</button>
            <button type="button" disabled={!adding || adding <= 0 || addSkeins.isPending}
              onClick={() => addSkeins.mutate({ yarnId: id, amount: adding! }, { onSuccess: () => setAdding(undefined) })}
              className="h-11 rounded-full bg-stash px-4 text-white">Add</button>
          </div>
        )}
        {addSkeins.error && <ErrorBox error={addSkeins.error} />}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- src/features/stash` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/stash
git commit -m "feat: add skeins to a yarn from its page"
```

---

### Task 5: Remove a planned yarn from a project

**Files:**
- Modify: `src/features/projects/api.ts`, `src/features/projects/ProjectPage.tsx`, `src/features/projects/ProjectPage.test.tsx`

**Interfaces:**
- Produces: `useRemovePlan()` — mutation `({ projectId: string; yarnId: string }) => void` deleting the `project_yarns` row.

- [ ] **Step 1: Write the failing test (in `src/features/projects/ProjectPage.test.tsx`)**

Give the fixture a plan so a line exists: set `project_yarns: [{ id: 'pl1', skeins_planned: 2, yarn: { id: 'y1', name: 'Fern green' } }]` in the mocked `useProject` data. Add `const removePlan = vi.fn();` with the other spies and `useRemovePlan: () => ({ mutate: removePlan })` to the `./api` mock factory. Then:

```tsx
test('a planned yarn can be removed after confirmation', async () => {
  renderWithProviders(<ProjectPage />, { route: '/projects/pr1', path: '/projects/:id' });
  await userEvent.click(screen.getByRole('button', { name: 'Remove plan for Fern green' }));
  expect(removePlan).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
  expect(removePlan).toHaveBeenCalledWith({ projectId: 'pr1', yarnId: 'y1' });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/features/projects/ProjectPage.test.tsx` — Expected: FAIL (no "Remove plan for Fern green").

- [ ] **Step 3: Implement**

`src/features/projects/api.ts`:
```ts
export function useRemovePlan() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async ({ projectId, yarnId }: { projectId: string; yarnId: string }) => {
      const { error } = await supabase.from('project_yarns').delete().eq('project_id', projectId).eq('yarn_id', yarnId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
```

`src/features/projects/ProjectPage.tsx`:
- `const removePlan = useRemovePlan();` and add `removePlan.error` to the `mutationError` `??` chain;
- extend the confirm state union with `{ kind: 'plan'; yarnId: string; name: string }`;
- replace the yarn lines grid with:

```tsx
      <div className="grid grid-cols-2 gap-2">
        {lines.map((l) => (
          <div key={l.yarnId} className="flex items-start gap-1 rounded-xl border border-line bg-surface p-2.5 text-sm">
            <Link to={`/stash/${l.yarnId}`} className="min-h-11 flex-1">
              {l.name}<br />{l.used} / {l.planned ?? '—'}
            </Link>
            {l.planned !== null && (
              <button type="button" aria-label={`Remove plan for ${l.name}`}
                onClick={() => setConfirm({ kind: 'plan', yarnId: l.yarnId, name: l.name })}
                className="h-11 w-11 shrink-0 text-muted">×</button>
            )}
          </div>
        ))}
      </div>
```

- in the `ConfirmDialog` props, handle the new kind: title `` `Remove the plan for ${confirm.name}?` ``, message `'Its reserved skeins go back to your stash. Yarn already used on parts stays.'`, confirm label `'Remove'`, and on confirm `removePlan.mutate({ projectId: id, yarnId: confirm.yarnId })`. Keep the existing project/part branches unchanged (if the dialog currently derives title/message with ternaries on `confirm?.kind`, add the `'plan'` branch to each; the confirm label becomes `confirm?.kind === 'plan' ? 'Remove' : 'Delete'`).

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- src/features/projects` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/projects
git commit -m "feat: remove a planned yarn from a project"
```

---

### Task 6: Pattern result photo (form, list, page, new-project picker)

**Files:**
- Create: `src/features/patterns/PatternThumb.tsx`
- Modify: `src/features/patterns/PatternForm.tsx`, `src/features/patterns/PatternList.tsx`, `src/features/patterns/PatternPage.tsx`, `src/features/projects/NewProject.tsx`, and their tests where a `../../lib/storage` mock exists (add `useSignedUrl: () => undefined` if missing)
- Test: `src/features/patterns/PatternForm.test.tsx`

**Interfaces:**
- Consumes: `PhotoField` (Task 2), `resizeImage`, `uploadFile`, `useSignedUrl` with bucket `'pattern-photos'`.
- Produces: `PatternThumb({ path: string | null; className: string })` — the result photo (signed URL) or a `bg-patterns-soft` placeholder filling `className`.

- [ ] **Step 1: Write the failing test (append to `src/features/patterns/PatternForm.test.tsx`)**

Make sure the file's `../../lib/storage` mock exposes `uploadFile` as a spy declared above it (`const uploadFile = vi.fn();`) plus `useSignedUrl: () => undefined`, and mock images: `vi.mock('../../lib/images', () => ({ resizeImage: async (f: Blob) => f }));`. Then:

```tsx
test('a result photo is uploaded to pattern-photos and saved with the pattern', async () => {
  uploadFile.mockResolvedValueOnce('u/result.jpg');
  URL.createObjectURL = vi.fn(() => 'blob:x');
  URL.revokeObjectURL = vi.fn();
  renderWithProviders(<PatternForm />, { route: '/patterns/new', path: '/patterns/new' });
  await userEvent.type(screen.getByLabelText('Name'), 'Bag A');
  await userEvent.upload(screen.getByLabelText('Take or choose a photo'), new File(['x'], 'bag.jpg', { type: 'image/jpeg' }));
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(uploadFile).toHaveBeenCalledWith('pattern-photos', expect.any(File), 'jpg');
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ pattern: expect.objectContaining({ name: 'Bag A', photo_path: 'u/result.jpg' }) }),
    expect.anything(),
  );
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/features/patterns/PatternForm.test.tsx` — Expected: FAIL (no "Take or choose a photo").

- [ ] **Step 3: Implement**

`src/features/patterns/PatternThumb.tsx`:
```tsx
import { useSignedUrl } from '../../lib/storage';

export default function PatternThumb({ path, className }: { path: string | null; className: string }) {
  const url = useSignedUrl('pattern-photos', path);
  return (
    <div className={`overflow-hidden bg-patterns-soft ${className}`}>
      {url && <img src={url} alt="" className="h-full w-full object-cover" />}
    </div>
  );
}
```

`src/features/patterns/PatternForm.tsx`:
- state `const [photo, setPhoto] = useState<File | null>(null);`;
- in `submit`, after the PDF upload block and inside the same try/catch style:
```tsx
    let photo_path = p.photo_path;
    if (photo) {
      try {
        photo_path = await uploadFile('pattern-photos', await resizeImage(photo), 'jpg');
      } catch (err) {
        setUploadError(err);
        return;
      }
    }
    save.mutate({ pattern: { ...p, pdf_path, photo_path }, parts }, { onSuccess: (newId) => navigate(`/patterns/${newId}`) });
```
- render, right after the Name field:
```tsx
      <PhotoField label="Result photo" bucket="pattern-photos" path={p.photo_path} file={photo}
        onFile={setPhoto} onRemove={() => set('photo_path', null)} />
```
- imports: `PhotoField`, `resizeImage` from `../../lib/images`.

`src/features/patterns/PatternList.tsx`: replace the card's `<div className="h-16 w-16 shrink-0 rounded-xl bg-patterns-soft" />` with `<PatternThumb path={p.photo_path} className="h-16 w-16 shrink-0 rounded-xl" />`.

`src/features/patterns/PatternPage.tsx`: right after the header, add `<PatternThumb path={p.photo_path} className="h-48 w-full rounded-3xl" />`.

`src/features/projects/NewProject.tsx`: replace the tile's `<div className="h-24 rounded-xl bg-patterns-soft" />` with `<PatternThumb path={p.photo_path} className="h-24 rounded-xl" />` (import from `../patterns/PatternThumb`). In `NewProject.test.tsx`, add `photo_path: null` to the mocked patterns and `vi.mock('../../lib/storage', () => ({ useSignedUrl: () => undefined }))` if absent. Do the same in `PatternList.test.tsx`.

- [ ] **Step 4: Run to verify pass**

Run: `npm test` and `npm run build` — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat: result photo on patterns"
```

---

### Task 7: Keep pattern parts (and their instructions) when a pattern is saved

**Files:**
- Modify: `src/features/patterns/logic.ts`, `src/features/patterns/logic.test.ts`, `src/features/patterns/api.ts`, `src/features/patterns/PatternForm.tsx`, `src/features/patterns/PatternForm.test.tsx`

**Interfaces:**
- Produces:
  - `type PartDraft = { id?: string; name: string; count: number; total_rows: number | null }` (id of an existing pattern part).
  - `cleanPartDrafts` keeps `id`.
  - `planPartChanges(existingIds: string[], drafts: PartDraft[]): { updates: (CleanPart & { id: string })[]; inserts: CleanPart[]; deleteIds: string[] }` where `CleanPart = { name: string; count: number; total_rows: number | null; position: number }`.
  - `usePatternInstructionCounts(patternId: string | undefined)` in `src/features/patterns/api.ts`: query `['instructions', 'counts', patternId]` returning `Map<patternPartId, number>` (also used by Task 8's pattern page buttons).

- [ ] **Step 1: Write the failing logic test (append to `src/features/patterns/logic.test.ts`)**

```ts
import { planPartChanges } from './logic';

test('planPartChanges updates kept parts, inserts new ones and deletes removed ones', () => {
  const plan = planPartChanges(['a', 'b', 'c'], [
    { id: 'a', name: ' Head ', count: 1, total_rows: 24 },
    { name: 'Tail', count: 1, total_rows: null },
    { id: 'c', name: 'Leg', count: 2, total_rows: 18 },
    { name: '', count: 1, total_rows: null },
  ]);
  expect(plan.updates).toEqual([
    { id: 'a', name: 'Head', count: 1, total_rows: 24, position: 0 },
    { id: 'c', name: 'Leg', count: 2, total_rows: 18, position: 2 },
  ]);
  expect(plan.inserts).toEqual([{ name: 'Tail', count: 1, total_rows: null, position: 1 }]);
  expect(plan.deleteIds).toEqual(['b']);
});

test('a kept id that no longer exists in the database is inserted instead', () => {
  const plan = planPartChanges([], [{ id: 'gone', name: 'Head', count: 1, total_rows: null }]);
  expect(plan.updates).toEqual([]);
  expect(plan.inserts).toEqual([{ name: 'Head', count: 1, total_rows: null, position: 0 }]);
});
```

Also update the existing `cleanPartDrafts` test expectation only if it now sees an `id` key (drafts without `id` must produce objects without an `id` key — keep it that way).

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/features/patterns/logic.test.ts` — Expected: FAIL (`planPartChanges` not exported).

- [ ] **Step 3: Implement the logic**

`src/features/patterns/logic.ts`:
```ts
export type PartDraft = { id?: string; name: string; count: number; total_rows: number | null };
export type CleanPart = { name: string; count: number; total_rows: number | null; position: number };

export function cleanPartDrafts(drafts: PartDraft[]): (CleanPart & { id?: string })[] {
  return drafts
    .map((d) => ({ ...d, name: d.name.trim(), count: Math.max(1, Math.floor(d.count || 1)) }))
    .filter((d) => d.name !== '')
    .map((d, position) => ({ ...d, position }));
}

/** What saving the form must do so that kept parts keep their id (and their instructions). */
export function planPartChanges(existingIds: string[], drafts: PartDraft[]) {
  const existing = new Set(existingIds);
  const cleaned = cleanPartDrafts(drafts);
  const updates: (CleanPart & { id: string })[] = [];
  const inserts: CleanPart[] = [];
  for (const { id, ...part } of cleaned) {
    if (id && existing.has(id)) updates.push({ id, ...part });
    else inserts.push(part);
  }
  const kept = new Set(updates.map((u) => u.id));
  return { updates, inserts, deleteIds: existingIds.filter((id) => !kept.has(id)) };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- src/features/patterns/logic.test.ts` — Expected: PASS.

- [ ] **Step 5: Use it in `useSavePattern` and add `usePatternInstructionCounts` (`src/features/patterns/api.ts`)**

Replace the body after `const patternId = saved.data.id;` with:
```ts
      const old = await supabase.from('pattern_parts').select('id').eq('pattern_id', patternId);
      if (old.error) throw old.error;
      const plan = planPartChanges(old.data.map((r) => r.id), parts);
      for (const { id: partId, ...fields } of plan.updates) {
        const up = await supabase.from('pattern_parts').update(fields).eq('id', partId);
        if (up.error) throw up.error;
      }
      if (plan.inserts.length > 0) {
        const ins = await supabase.from('pattern_parts').insert(plan.inserts.map((p) => ({ ...p, pattern_id: patternId })));
        if (ins.error) throw ins.error;
      }
      if (plan.deleteIds.length > 0) {
        const del = await supabase.from('pattern_parts').delete().in('id', plan.deleteIds);
        if (del.error) throw del.error;
      }
      return patternId;
```
(import `planPartChanges` instead of `cleanPartDrafts`; keep the template-copy comment, reworded: "Kept parts are updated in place so their instructions survive; projects copied from them are unaffected.")

Add:
```ts
/** Number of instruction pictures per pattern part of one pattern. */
export function usePatternInstructionCounts(patternId: string | undefined) {
  return useQuery({
    queryKey: ['instructions', 'counts', patternId],
    enabled: patternId !== undefined,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('part_instructions')
        .select('pattern_part_id, pattern_parts!inner(pattern_id)')
        .eq('pattern_parts.pattern_id', patternId!);
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const r of data) counts.set(r.pattern_part_id, (counts.get(r.pattern_part_id) ?? 0) + 1);
      return counts;
    },
  });
}
```

- [ ] **Step 6: Keep ids in the form and confirm removal of a part with instructions**

`src/features/patterns/PatternForm.tsx`:
- in `PatternForm`, map existing parts with their id: `existing.data?.parts.map((p) => ({ id: p.id, name: p.name, count: p.count, total_rows: p.total_rows }))`;
- in `PatternFormBody`: `const counts = usePatternInstructionCounts(initial.id);` and `const [removing, setRemoving] = useState<number | null>(null);`
- the remove button becomes:
```tsx
          <button type="button" aria-label="Remove part" className="h-11 w-11 text-muted"
            onClick={() => {
              const n = part.id ? counts.data?.get(part.id) ?? 0 : 0;
              if (n > 0) setRemoving(i);
              else setParts(parts.filter((_, j) => j !== i));
            }}>×</button>
```
- at the end of the form:
```tsx
      <ConfirmDialog
        open={removing !== null}
        title={`Remove ${removing !== null ? parts[removing].name : ''}?`}
        message="Its instructions are deleted too when you save."
        confirmLabel="Remove"
        onCancel={() => setRemoving(null)}
        onConfirm={() => { setParts(parts.filter((_, j) => j !== removing)); setRemoving(null); }}
      />
```
- import `ConfirmDialog` and `usePatternInstructionCounts`.

`src/features/patterns/PatternForm.test.tsx` — make the `./api` mock switchable and add the test:

```tsx
const fixture = vi.hoisted(() => ({ pattern: undefined as unknown, counts: new Map<string, number>() }));
// in the existing vi.mock('./api', () => ({ ... })) factory, use:
//   usePattern: () => ({ data: fixture.pattern, isPending: false, error: null }),
//   usePatternInstructionCounts: () => ({ data: fixture.counts }),
beforeEach(() => { fixture.pattern = undefined; fixture.counts = new Map(); save.mockClear(); });

test('removing a part that has instructions asks first', async () => {
  fixture.pattern = {
    id: 'p1', name: 'T-rex', pattern_type_id: null, designer: null, url: null, hook_size_mm: null,
    yarn_weight: null, notes: null, pdf_path: null, photo_path: null, pdf_updated_at: null,
    parts: [{ id: 'pp1', name: 'Leg', count: 2, total_rows: 18, position: 0 }],
  };
  fixture.counts = new Map([['pp1', 2]]);
  renderWithProviders(<PatternForm />, { route: '/patterns/p1/edit', path: '/patterns/:id/edit' });
  await userEvent.click(screen.getByRole('button', { name: 'Remove part' }));
  expect(screen.getByRole('dialog', { name: 'Remove Leg?' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({ parts: [] }), expect.anything());
});

test('kept parts are sent with their id', async () => {
  fixture.pattern = {
    id: 'p1', name: 'T-rex', pattern_type_id: null, designer: null, url: null, hook_size_mm: null,
    yarn_weight: null, notes: null, pdf_path: null, photo_path: null, pdf_updated_at: null,
    parts: [{ id: 'pp1', name: 'Leg', count: 2, total_rows: 18, position: 0 }],
  };
  renderWithProviders(<PatternForm />, { route: '/patterns/p1/edit', path: '/patterns/:id/edit' });
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ parts: [{ id: 'pp1', name: 'Leg', count: 2, total_rows: 18 }] }),
    expect.anything(),
  );
});
```

- [ ] **Step 7: Run tests and build; commit**

Run: `npm test` and `npm run build` — Expected: PASS.

```bash
git add src/features/patterns
git commit -m "fix: keep pattern parts on save so their instructions survive"
```

---

### Task 8: Part instructions — page parser, PDF rendering, screen, pattern page buttons

**Files:**
- Create: `src/features/instructions/pageRanges.ts`, `src/features/instructions/pageRanges.test.ts`, `src/features/instructions/pdf.ts`, `src/features/instructions/api.ts`, `src/features/instructions/InstructionThumb.tsx`, `src/features/instructions/PartInstructionsPage.tsx`, `src/features/instructions/PartInstructionsPage.test.tsx`
- Modify: `package.json` (+ `pdfjs-dist`), `src/App.tsx` (route), `src/features/patterns/PatternPage.tsx` (Instructions buttons)

**Interfaces:**
- Consumes: `usePattern`, `usePatternInstructionCounts` (Task 7), `uploadFile`, `removeFile`, `useSignedUrl`, `resizeImage`, `ConfirmDialog`, `ErrorBox`, `useInvalidateAll`.
- Produces:
  - `parsePageRanges(input: string, max?: number): { pages: number[] } | { error: string }` — tokens separated by commas, each `N` or `A-B` (A ≤ B), spaces ignored, duplicates removed (first occurrence order kept). Errors: empty → `'Enter at least one page.'`; bad syntax → `'Use page numbers like 3, 3-4 or 3, 5-6.'`; page 0 → same syntax message; `max` given and a page > max → `` `Page ${n} doesn't exist — the PDF has ${max} pages.` ``.
  - `openPdf(url: string, width?: number): Promise<{ numPages: number; render: (page: number) => Promise<Blob> }>` (in `pdf.ts`) — JPEG 0.8 at `width` (default 1600) px, white background.
  - In `api.ts`: `type Instruction = Tables<'part_instructions'>`; `usePartInstructions(patternPartId: string | null)` (query `['instructions', patternPartId]`, ordered by position); `useAddPdfPages()` mutation `({ patternPartId, pdfPath, pages, startPosition }) => void`; `useAddInstructionPhotos()` mutation `({ patternPartId, files, startPosition }) => void`; `useRemoveInstruction()` mutation `(i: Instruction) => void`; `nextInstructionPosition(list: { position: number }[]): number`.
  - `InstructionThumb({ path: string; alt: string; className: string })`.
  - Route `/patterns/:id/parts/:partId` → `PartInstructionsPage`.

- [ ] **Step 1: Install pdf.js**

Run: `npm install pdfjs-dist@^5`
Expected: `pdfjs-dist` added to `dependencies`.

- [ ] **Step 2: Write the failing parser tests — `src/features/instructions/pageRanges.test.ts`**

```ts
import { parsePageRanges } from './pageRanges';

test.each([
  ['3', [3]],
  ['3-4', [3, 4]],
  ['3, 5, 7-8', [3, 5, 7, 8]],
  [' 2 ,2, 1-2 ', [2, 1]],
])('parsePageRanges(%j)', (input, pages) => {
  expect(parsePageRanges(input)).toEqual({ pages });
});

test.each([
  ['', 'Enter at least one page.'],
  ['abc', 'Use page numbers like 3, 3-4 or 3, 5-6.'],
  ['4-2', 'Use page numbers like 3, 3-4 or 3, 5-6.'],
  ['0', 'Use page numbers like 3, 3-4 or 3, 5-6.'],
  ['3,,4', 'Use page numbers like 3, 3-4 or 3, 5-6.'],
])('rejects %j', (input, error) => {
  expect(parsePageRanges(input)).toEqual({ error });
});

test('pages beyond the PDF are refused', () => {
  expect(parsePageRanges('7-9', 8)).toEqual({ error: "Page 9 doesn't exist — the PDF has 8 pages." });
  expect(parsePageRanges('7-8', 8)).toEqual({ pages: [7, 8] });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- src/features/instructions/pageRanges.test.ts` — Expected: FAIL (module missing).

- [ ] **Step 4: Implement `src/features/instructions/pageRanges.ts`**

```ts
const SYNTAX = 'Use page numbers like 3, 3-4 or 3, 5-6.';

export function parsePageRanges(input: string, max?: number): { pages: number[] } | { error: string } {
  const text = input.replace(/\s+/g, '');
  if (text === '') return { error: 'Enter at least one page.' };
  const pages: number[] = [];
  for (const token of text.split(',')) {
    const m = /^(\d+)(?:-(\d+))?$/.exec(token);
    if (!m) return { error: SYNTAX };
    const from = Number(m[1]);
    const to = m[2] === undefined ? from : Number(m[2]);
    if (from < 1 || to < from) return { error: SYNTAX };
    for (let n = from; n <= to; n++) if (!pages.includes(n)) pages.push(n);
  }
  if (max !== undefined) {
    const tooFar = pages.find((n) => n > max);
    if (tooFar !== undefined) return { error: `Page ${tooFar} doesn't exist — the PDF has ${max} pages.` };
  }
  return { pages };
}
```

Run: `npm test -- src/features/instructions/pageRanges.test.ts` — Expected: PASS.

- [ ] **Step 5: Write `src/features/instructions/pdf.ts`**

```ts
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** Opens a PDF and renders pages to JPEG blobs (white background, quality 0.8). */
export async function openPdf(url: string, width = 1600) {
  const doc = await pdfjs.getDocument({ url }).promise;
  return {
    numPages: doc.numPages,
    async render(pageNumber: number): Promise<Blob> {
      const page = await doc.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: width / base.width });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const context = canvas.getContext('2d')!;
      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvas, canvasContext: context, viewport }).promise;
      return new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not render the page'))), 'image/jpeg', 0.8),
      );
    },
  };
}
```

(`#FFFFFF` here is canvas paint for the image itself, not UI color, so the theme-token rule doesn't apply.)

- [ ] **Step 6: Write `src/features/instructions/api.ts`**

```ts
import { useMutation, useQuery } from '@tanstack/react-query';
import { resizeImage } from '../../lib/images';
import { useInvalidateAll } from '../../lib/invalidate';
import { removeFile, uploadFile } from '../../lib/storage';
import { supabase, type Tables } from '../../lib/supabase';
import { openPdf } from './pdf';

export type Instruction = Tables<'part_instructions'>;

const messageOf = (e: unknown) =>
  e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);

export function nextInstructionPosition(list: { position: number }[]): number {
  return list.reduce((max, i) => Math.max(max, i.position + 1), 0);
}

export function usePartInstructions(patternPartId: string | null) {
  return useQuery({
    queryKey: ['instructions', patternPartId],
    enabled: patternPartId !== null,
    queryFn: async (): Promise<Instruction[]> => {
      const { data, error } = await supabase
        .from('part_instructions').select().eq('pattern_part_id', patternPartId!).order('position');
      if (error) throw error;
      return data;
    },
  });
}

export function useAddPdfPages() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (v: { patternPartId: string; pdfPath: string; pages: number[]; startPosition: number }) => {
      const signed = await supabase.storage.from('pattern-pdfs').createSignedUrl(v.pdfPath, 600);
      if (signed.error) throw signed.error;
      const pdf = await openPdf(signed.data.signedUrl);
      const tooFar = v.pages.find((n) => n > pdf.numPages);
      if (tooFar !== undefined) throw new Error(`Page ${tooFar} doesn't exist — the PDF has ${pdf.numPages} pages.`);
      for (const [i, n] of v.pages.entries()) {
        try {
          const path = await uploadFile('pattern-instructions', await pdf.render(n), 'jpg');
          const ins = await supabase.from('part_instructions').insert({
            pattern_part_id: v.patternPartId, position: v.startPosition + i, kind: 'pdf_page', pdf_page: n, image_path: path,
          });
          if (ins.error) throw ins.error;
        } catch (err) {
          throw new Error(`Page ${n} couldn't be added: ${messageOf(err)}`);
        }
      }
    },
    onSettled: invalidate,
  });
}

export function useAddInstructionPhotos() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (v: { patternPartId: string; files: File[]; startPosition: number }) => {
      for (const [i, file] of v.files.entries()) {
        const path = await uploadFile('pattern-instructions', await resizeImage(file), 'jpg');
        const ins = await supabase.from('part_instructions').insert({
          pattern_part_id: v.patternPartId, position: v.startPosition + i, kind: 'photo', image_path: path,
        });
        if (ins.error) throw ins.error;
      }
    },
    onSettled: invalidate,
  });
}

export function useRemoveInstruction() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (instruction: Instruction) => {
      const { error } = await supabase.from('part_instructions').delete().eq('id', instruction.id);
      if (error) throw error;
      // The picture itself: best effort, the row is what the app shows.
      await removeFile('pattern-instructions', instruction.image_path).catch(() => undefined);
    },
    onSuccess: invalidate,
  });
}
```

- [ ] **Step 7: Write the failing screen tests — `src/features/instructions/PartInstructionsPage.test.tsx`**

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import PartInstructionsPage from './PartInstructionsPage';

const addPages = vi.fn();
const addPhotos = vi.fn();
const remove = vi.fn();
const fx = vi.hoisted(() => ({
  pdfPath: 'u/t-rex.pdf' as string | null,
  pdfUpdatedAt: '2026-10-01T10:00:00Z' as string | null,
  list: [] as unknown[],
}));

vi.mock('../patterns/api', () => ({
  usePattern: () => ({
    data: {
      id: 'p1', name: 'T-rex', pdf_path: fx.pdfPath, pdf_updated_at: fx.pdfUpdatedAt,
      parts: [{ id: 'pp1', name: 'Leg', count: 2, total_rows: 18, position: 0 }],
    },
    isPending: false, error: null, refetch: vi.fn(),
  }),
}));
vi.mock('./api', () => ({
  usePartInstructions: () => ({ data: fx.list, isPending: false, error: null }),
  useAddPdfPages: () => ({ mutate: addPages, isPending: false, error: null }),
  useAddInstructionPhotos: () => ({ mutate: addPhotos, isPending: false, error: null }),
  useRemoveInstruction: () => ({ mutate: remove, error: null }),
  nextInstructionPosition: (l: { position: number }[]) => l.length,
}));
vi.mock('../../lib/storage', () => ({ useSignedUrl: () => undefined }));

const route = { route: '/patterns/p1/parts/pp1', path: '/patterns/:id/parts/:partId' };
beforeEach(() => {
  fx.pdfPath = 'u/t-rex.pdf';
  fx.pdfUpdatedAt = '2026-10-01T10:00:00Z';
  fx.list = [];
  addPages.mockClear(); addPhotos.mockClear(); remove.mockClear();
});

test('adds the typed PDF pages after the existing pictures', async () => {
  fx.list = [{ id: 'i1', position: 0, kind: 'photo', pdf_page: null, image_path: 'u/a.jpg', created_at: '2026-10-02T00:00:00Z' }];
  renderWithProviders(<PartInstructionsPage />, route);
  expect(screen.getByRole('heading', { name: 'T-rex · Leg' })).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('PDF pages'), '3-4');
  await userEvent.click(screen.getByRole('button', { name: 'Add pages' }));
  expect(addPages).toHaveBeenCalledWith(
    { patternPartId: 'pp1', pdfPath: 'u/t-rex.pdf', pages: [3, 4], startPosition: 1 },
    expect.anything(),
  );
});

test('invalid page input shows a message and adds nothing', async () => {
  renderWithProviders(<PartInstructionsPage />, route);
  await userEvent.type(screen.getByLabelText('PDF pages'), 'abc');
  await userEvent.click(screen.getByRole('button', { name: 'Add pages' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Use page numbers like 3, 3-4 or 3, 5-6.');
  expect(addPages).not.toHaveBeenCalled();
});

test('without a PDF, adding pages is disabled with a hint', () => {
  fx.pdfPath = null;
  renderWithProviders(<PartInstructionsPage />, route);
  expect(screen.getByRole('button', { name: 'Add pages' })).toBeDisabled();
  expect(screen.getByText('Attach a PDF to the pattern first.')).toBeInTheDocument();
});

test('photos are added in one go', async () => {
  renderWithProviders(<PartInstructionsPage />, route);
  const a = new File(['a'], 'a.jpg', { type: 'image/jpeg' });
  const b = new File(['b'], 'b.jpg', { type: 'image/jpeg' });
  await userEvent.upload(screen.getByLabelText('Add photos'), [a, b]);
  expect(addPhotos).toHaveBeenCalledWith({ patternPartId: 'pp1', files: [a, b], startPosition: 0 });
});

test('removing a picture asks first', async () => {
  fx.list = [{ id: 'i1', position: 0, kind: 'pdf_page', pdf_page: 3, image_path: 'u/p3.jpg', created_at: '2026-10-02T00:00:00Z' }];
  renderWithProviders(<PartInstructionsPage />, route);
  await userEvent.click(screen.getByRole('button', { name: 'Remove page 3' }));
  expect(remove).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
  expect(remove).toHaveBeenCalledWith(fx.list[0]);
});

test('a note appears when the PDF was replaced after pages were added', () => {
  fx.pdfUpdatedAt = '2026-10-05T00:00:00Z';
  fx.list = [{ id: 'i1', position: 0, kind: 'pdf_page', pdf_page: 3, image_path: 'u/p3.jpg', created_at: '2026-10-02T00:00:00Z' }];
  renderWithProviders(<PartInstructionsPage />, route);
  expect(screen.getByText('The PDF was replaced — re-add pages if they changed.')).toBeInTheDocument();
});
```

- [ ] **Step 8: Run to verify failure**

Run: `npm test -- src/features/instructions/PartInstructionsPage.test.tsx` — Expected: FAIL (module missing).

- [ ] **Step 9: Implement the thumbnail and the screen**

`src/features/instructions/InstructionThumb.tsx`:
```tsx
import { useSignedUrl } from '../../lib/storage';

export default function InstructionThumb({ path, alt, className }: { path: string; alt: string; className: string }) {
  const url = useSignedUrl('pattern-instructions', path);
  return (
    <div className={`overflow-hidden bg-divider ${className}`}>
      {url && <img src={url} alt={alt} className="h-full w-full object-contain" />}
    </div>
  );
}
```

`src/features/instructions/PartInstructionsPage.tsx`:
```tsx
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import ConfirmDialog from '../../components/ConfirmDialog';
import ErrorBox from '../../components/ErrorBox';
import { usePattern } from '../patterns/api';
import {
  nextInstructionPosition, useAddInstructionPhotos, useAddPdfPages, usePartInstructions, useRemoveInstruction,
  type Instruction,
} from './api';
import InstructionThumb from './InstructionThumb';
import { parsePageRanges } from './pageRanges';

const label = (i: Instruction) => (i.kind === 'pdf_page' ? `page ${i.pdf_page}` : 'photo');

export default function PartInstructionsPage() {
  const { id, partId } = useParams() as { id: string; partId: string };
  const pattern = usePattern(id);
  const list = usePartInstructions(partId);
  const addPages = useAddPdfPages();
  const addPhotos = useAddInstructionPhotos();
  const remove = useRemoveInstruction();
  const [pages, setPages] = useState('');
  const [pageError, setPageError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Instruction | null>(null);

  if (pattern.error) return <ErrorBox error={pattern.error} onRetry={() => pattern.refetch()} />;
  if (pattern.isPending || !pattern.data) return <p className="p-4 text-muted">Loading…</p>;
  const p = pattern.data;
  const part = p.parts.find((x) => x.id === partId);
  if (!part) return <ErrorBox error={new Error('This part no longer exists.')} />;

  const items = list.data ?? [];
  const start = nextInstructionPosition(items);
  const busy = addPages.isPending || addPhotos.isPending;
  const pdfReplaced = p.pdf_updated_at !== null && items.some(
    (i) => i.kind === 'pdf_page' && new Date(i.created_at).getTime() < new Date(p.pdf_updated_at!).getTime(),
  );
  const error = list.error ?? addPages.error ?? addPhotos.error ?? remove.error;

  function submitPages() {
    const parsed = parsePageRanges(pages);
    if ('error' in parsed) { setPageError(parsed.error); return; }
    setPageError(null);
    addPages.mutate(
      { patternPartId: partId, pdfPath: p.pdf_path!, pages: parsed.pages, startPosition: start },
      { onSuccess: () => setPages('') },
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <Link to={`/patterns/${id}`} className="flex min-h-11 items-center self-start text-patterns">‹ {p.name}</Link>
      <h1 className="text-3xl">{p.name} · {part.name}</h1>
      {error && <ErrorBox error={error} />}
      {pdfReplaced && <p className="rounded-xl bg-sun-track p-3 text-sm">The PDF was replaced — re-add pages if they changed.</p>}

      <section className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3">
        <label className="flex flex-col gap-1 text-sm text-muted">PDF pages
          <input value={pages} onChange={(e) => setPages(e.target.value)} placeholder="3-4 or 3, 5"
            disabled={!p.pdf_path} className="h-11 rounded-xl border border-line px-3 text-ink" />
        </label>
        {!p.pdf_path && <p className="text-sm text-muted">Attach a PDF to the pattern first.</p>}
        {pageError && <p role="alert" className="text-projects-dark">{pageError}</p>}
        <button type="button" onClick={submitPages} disabled={!p.pdf_path || busy}
          className="h-11 self-start rounded-full bg-patterns px-5 text-white">Add pages</button>
      </section>

      <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-full border-[1.5px] border-dashed border-muted bg-surface px-4 text-sm">
        {busy ? 'Adding…' : 'Add photos'}
        <input type="file" accept="image/*" multiple className="sr-only" aria-label="Add photos"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            if (files.length > 0) addPhotos.mutate({ patternPartId: partId, files, startPosition: start });
          }} />
      </label>

      <ul className="grid grid-cols-3 gap-2">
        {items.map((i) => (
          <li key={i.id} className="relative flex flex-col gap-1">
            <InstructionThumb path={i.image_path} alt={`Instructions ${label(i)}`} className="h-28 rounded-xl" />
            <span className="text-xs text-muted">{label(i)}</span>
            <button type="button" aria-label={`Remove ${label(i)}`} onClick={() => setRemoving(i)}
              className="absolute right-0 top-0 h-11 w-11 rounded-full bg-surface/80 text-muted">×</button>
          </li>
        ))}
      </ul>
      {items.length === 0 && <p className="text-muted">No instructions yet.</p>}

      <ConfirmDialog
        open={removing !== null}
        title={`Remove this ${removing ? label(removing) : ''}?`}
        message="It disappears from this part's instructions."
        confirmLabel="Remove"
        onCancel={() => setRemoving(null)}
        onConfirm={() => { if (removing) remove.mutate(removing); setRemoving(null); }}
      />
    </div>
  );
}
```

- [ ] **Step 10: Route and pattern page buttons**

`src/App.tsx`: import `PartInstructionsPage from './features/instructions/PartInstructionsPage'` and add, after `patterns/:id/edit`:
```tsx
        <Route path="patterns/:id/parts/:partId" element={<PartInstructionsPage />} />
```

`src/features/patterns/PatternPage.tsx`: `const counts = usePatternInstructionCounts(id);` and in each part row, after the rows text, add:
```tsx
            <Link to={`/patterns/${id}/parts/${part.id}`} className="flex min-h-11 items-center text-sm text-patterns">
              Instructions · {counts.data?.get(part.id) ?? 0}
            </Link>
```
(change the row's container to `flex items-center justify-between gap-2`).

- [ ] **Step 11: Run tests and build; commit**

Run: `npm test` and `npm run build` — Expected: PASS (the build bundles the pdf.js worker as a separate asset).

```bash
git add package.json package-lock.json src
git commit -m "feat: per-part instructions from PDF pages or photos"
```

---

### Task 9: Part page — timer button, instructions section, full-screen viewer

**Files:**
- Create: `src/features/timer/PartTimerButton.tsx`, `src/features/timer/PartTimerButton.test.tsx`, `src/features/instructions/InstructionViewer.tsx`, `src/features/instructions/InstructionsSection.tsx`, `src/features/instructions/InstructionsSection.test.tsx`
- Modify: `src/features/parts/PartPage.tsx`, `src/features/parts/PartPage.test.tsx`

**Interfaces:**
- Consumes: `useRunningSession`, `useStartTimer`, `useStopTimer` (timer/api), `useNow`, `sessionSeconds`, `formatClock`, `usePartInstructions`, `InstructionThumb`.
- Produces:
  - `PartTimerButton({ partId: string })` — full-width `bg-timer` button: idle "▶ Start timing" (aria-label "Start timing"); when this part runs, "■ Stop · h:mm:ss" (aria-label "Stop timing") with the current session's elapsed time; a `role="alert"` line on failure ("Couldn't start" / "Couldn't stop").
  - `InstructionViewer({ items: { path: string; label: string }[]; index: number; onIndex: (i: number) => void; onClose: () => void })` — fixed full-screen `bg-ink` overlay (`role="dialog"`, `aria-label="Instructions"`), image in a scrollable box with `touch-action: pinch-zoom`, buttons "Previous" / "Next" (disabled at the ends) and "Close", all ≥ 44 px.
  - `InstructionsSection({ patternPartId: string })` — heading "Instructions", the pictures full width in order (each a button "Open {label}"), opens the viewer; renders nothing when there are no pictures.

- [ ] **Step 1: Write the failing tests**

`src/features/timer/PartTimerButton.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PartTimerButton from './PartTimerButton';

const start = vi.fn();
const stop = vi.fn();
const fx = vi.hoisted(() => ({ running: null as unknown }));
vi.mock('./api', () => ({
  useRunningSession: () => ({ data: fx.running }),
  useStartTimer: () => ({ mutate: start, error: null }),
  useStopTimer: () => ({ mutate: stop, error: null }),
}));
vi.mock('./useNow', () => ({ useNow: () => new Date('2026-10-08T20:12:05Z') }));

test('idle: starts timing this part', async () => {
  fx.running = null;
  render(<PartTimerButton partId="pt1" />);
  await userEvent.click(screen.getByRole('button', { name: 'Start timing' }));
  expect(start).toHaveBeenCalledWith('pt1');
});

test('running here: shows the session clock and stops', async () => {
  fx.running = { started_at: '2026-10-08T20:00:00Z', part: { id: 'pt1' } };
  render(<PartTimerButton partId="pt1" />);
  const button = screen.getByRole('button', { name: 'Stop timing' });
  expect(button).toHaveTextContent('0:12:05');
  await userEvent.click(button);
  expect(stop).toHaveBeenCalled();
});

test('another part running: offers to start this one', () => {
  fx.running = { started_at: '2026-10-08T20:00:00Z', part: { id: 'other' } };
  render(<PartTimerButton partId="pt1" />);
  expect(screen.getByRole('button', { name: 'Start timing' })).toBeInTheDocument();
});
```

`src/features/instructions/InstructionsSection.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InstructionsSection from './InstructionsSection';

const fx = vi.hoisted(() => ({ list: [] as unknown[] }));
vi.mock('./api', () => ({ usePartInstructions: () => ({ data: fx.list }) }));
vi.mock('../../lib/storage', () => ({ useSignedUrl: (_b: string, p: string | null) => (p ? `https://signed/${p}` : undefined) }));

test('renders nothing without pictures', () => {
  fx.list = [];
  const { container } = render(<InstructionsSection patternPartId="pp1" />);
  expect(container).toBeEmptyDOMElement();
});

test('shows pictures in order and opens the full-screen viewer', async () => {
  fx.list = [
    { id: 'a', position: 0, kind: 'pdf_page', pdf_page: 3, image_path: 'u/p3.jpg' },
    { id: 'b', position: 1, kind: 'photo', pdf_page: null, image_path: 'u/ph.jpg' },
  ];
  render(<InstructionsSection patternPartId="pp1" />);
  expect(screen.getByRole('heading', { name: 'Instructions' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Open page 3' }));
  const viewer = screen.getByRole('dialog', { name: 'Instructions' });
  expect(viewer.querySelector('img')).toHaveAttribute('src', 'https://signed/u/p3.jpg');
  expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
  await userEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(viewer.querySelector('img')).toHaveAttribute('src', 'https://signed/u/ph.jpg');
  await userEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('dialog')).toBeNull();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- src/features/timer/PartTimerButton.test.tsx src/features/instructions/InstructionsSection.test.tsx` — Expected: FAIL (modules missing).

- [ ] **Step 3: Implement**

`src/features/timer/PartTimerButton.tsx`:
```tsx
import { formatClock, sessionSeconds } from '../../lib/calc';
import { useRunningSession, useStartTimer, useStopTimer } from './api';
import { useNow } from './useNow';

export default function PartTimerButton({ partId }: { partId: string }) {
  const running = useRunningSession();
  const start = useStartTimer();
  const stop = useStopTimer();
  const now = useNow();
  const session = running.data?.part.id === partId ? running.data : null;
  const failed = session ? stop.error : start.error;

  return (
    <div className="flex flex-col gap-1">
      {session ? (
        <button type="button" aria-label="Stop timing" onClick={() => stop.mutate()}
          className="min-h-14 rounded-full bg-timer text-lg text-white">
          ■ Stop · {formatClock(sessionSeconds({ started_at: session.started_at, ended_at: null }, now))}
        </button>
      ) : (
        <button type="button" aria-label="Start timing" onClick={() => start.mutate(partId)}
          className="min-h-14 rounded-full bg-timer text-lg text-white">
          ▶ Start timing
        </button>
      )}
      {failed && <p role="alert" className="text-sm text-projects-dark">{session ? "Couldn't stop" : "Couldn't start"}</p>}
    </div>
  );
}
```

`src/features/instructions/InstructionViewer.tsx`:
```tsx
import { useSignedUrl } from '../../lib/storage';

type Props = { items: { path: string; label: string }[]; index: number; onIndex: (i: number) => void; onClose: () => void };

export default function InstructionViewer({ items, index, onIndex, onClose }: Props) {
  const item = items[index];
  const url = useSignedUrl('pattern-instructions', item.path);
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
```

`src/features/instructions/InstructionsSection.tsx`:
```tsx
import { useState } from 'react';
import { usePartInstructions } from './api';
import InstructionThumb from './InstructionThumb';
import InstructionViewer from './InstructionViewer';

export default function InstructionsSection({ patternPartId }: { patternPartId: string }) {
  const { data } = usePartInstructions(patternPartId);
  const [open, setOpen] = useState<number | null>(null);
  const items = (data ?? []).map((i) => ({
    path: i.image_path,
    label: i.kind === 'pdf_page' ? `page ${i.pdf_page}` : 'photo',
  }));
  if (items.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm uppercase tracking-wide text-muted">Instructions</h2>
      {items.map((it, i) => (
        <button key={it.path} type="button" aria-label={`Open ${it.label}`} onClick={() => setOpen(i)}
          className="overflow-hidden rounded-2xl border border-line bg-surface">
          <InstructionThumb path={it.path} alt={`Instructions ${it.label}`} className="w-full" />
        </button>
      ))}
      {open !== null && <InstructionViewer items={items} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </section>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- src/features/timer/PartTimerButton.test.tsx src/features/instructions/InstructionsSection.test.tsx` — Expected: PASS.

- [ ] **Step 5: Re-order the part page**

`src/features/parts/PartPage.tsx` — after the name / Done row insert `<PartTimerButton partId={id} />`; after the row-counter `<section>` insert
```tsx
      {part.pattern_part_id && <InstructionsSection patternPartId={part.pattern_part_id} />}
```
Imports: `PartTimerButton from '../timer/PartTimerButton'`, `InstructionsSection from '../instructions/InstructionsSection'`.

`src/features/parts/PartPage.test.tsx` — add to the mocks:
```tsx
vi.mock('../timer/PartTimerButton', () => ({ default: ({ partId }: { partId: string }) => <div data-testid="timer">{partId}</div> }));
vi.mock('../instructions/InstructionsSection', () => ({
  default: ({ patternPartId }: { patternPartId: string }) => <div data-testid="instructions">{patternPartId}</div>,
}));
```
set `pattern_part_id: 'pp1'` in the part fixture, and add:
```tsx
test('the part page has the timer and the instructions of its pattern part', () => {
  renderWithProviders(<PartPage />, { route: '/parts/pt1', path: '/parts/:id' });
  expect(screen.getByTestId('timer')).toHaveTextContent('pt1');
  expect(screen.getByTestId('instructions')).toHaveTextContent('pp1');
});
```

- [ ] **Step 6: Run tests and build; commit**

Run: `npm test` and `npm run build` — Expected: PASS.

```bash
git add src
git commit -m "feat: timer and instructions on the part page"
```

---

### Task 10: End-to-end — instructions, add skeins

**Files:**
- Modify: `e2e/main-flow.spec.ts`

**Interfaces:**
- Consumes: the whole app on the local stack (port 7421).

- [ ] **Step 1: Add a PDF builder at the top of `e2e/main-flow.spec.ts`**

```ts
/** A one-page PDF with a line of text, built in memory (xref offsets computed). */
function onePagePdf(text: string): Buffer {
  const content = `BT /F1 24 Tf 40 150 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) pdf += `${String(o).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}
```

- [ ] **Step 2: Extend the flow**

In the pattern section, before clicking Save, attach the PDF:
```ts
  await page.locator('input[type="file"][accept="application/pdf"]')
    .setInputFiles({ name: 't-rex.pdf', mimeType: 'application/pdf', buffer: onePagePdf('Leg: 6 sc in MR') });
```

Right after saving the pattern (on the pattern page) and before "Start a project from this pattern", add:
```ts
  // Instructions for Leg: page 1 of the PDF
  await page.getByRole('link', { name: 'Instructions · 0' }).nth(1).click();
  await page.getByLabel('PDF pages').fill('1');
  await page.getByRole('button', { name: 'Add pages' }).click();
  await expect(page.getByRole('img', { name: 'Instructions page 1' })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('link', { name: '‹ T-rex' }).click();
  await expect(page.getByRole('link', { name: 'Instructions · 1' })).toBeVisible();
```

After the project is started and before the timer steps, check the part page:
```ts
  await page.getByRole('link', { name: /Leg 1/ }).click();
  await expect(page.getByRole('button', { name: 'Start timing' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Instructions page 1' })).toBeVisible();
  await page.goBack();
```

Replace the final stash check with:
```ts
  await page.goto('/stash');
  await expect(page.getByRole('link', { name: /Fern green/ })).toContainText('2.5 sk free / 3 sk');

  // Add 2 skeins from the yarn page
  await page.getByRole('link', { name: /Fern green/ }).click();
  await page.getByRole('button', { name: '+ Add skeins' }).click();
  await page.getByLabel('How many skeins?').fill('2');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.goto('/stash');
  await expect(page.getByRole('link', { name: /Fern green/ })).toContainText('4.5 sk free / 5 sk');
```

- [ ] **Step 3: Run the end-to-end test**

Run: `npm run db:reset` (fresh local data), then `npm run e2e`
Expected: `1 passed`. Make sure port 7421 is free afterwards.

- [ ] **Step 4: Run every suite once more and commit**

Run: `npm test`, `npm run test:db`, `npm run build` — Expected: all PASS.

```bash
git add e2e
git commit -m "test: end-to-end covers part instructions and adding skeins"
```
