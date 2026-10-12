# Crochet Tracker Phase 1.2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Yarn lists with suggestions, a fiber dropdown, colour families and stash search, pattern materials, yarn plans when starting a project, and "Update from pattern" on projects.

**Architecture:** One migration adds the lists (`catalog_yarns`, `shops`, `fibers`, filled by a trigger on `yarns` and an `import_lists` RPC), the `colour_family` enum, pattern material tables, `parts.from_pattern`, a plans argument on `start_project_from_pattern` and a new `apply_pattern_update` RPC. The UI adds two shared components (`SuggestField`, `ColourDots`), a `lists` feature (Manage lists page), a `materials` feature (pattern form section and display), a start-project page with yarn pickers, and an update preview on the project page. Every rule that can be pure (`parseYarnList`, `filterYarns`, `diffProjectWithPattern`, `planRows`) is a tested pure function.

**Tech Stack:** React 19, Vite 6, TypeScript, Tailwind 4, React Router 7 (`react-router`), TanStack Query 5, Supabase (Postgres + RLS), Vitest + RTL + user-event, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-12-crochet-tracker-phase-1-2-design.md` (builds on the Phase 1 and Phase 1.1 specs in the same folder).

## Global Constraints

- Touch targets are at least 44 px: use `h-11` / `min-h-11` / `w-11` (or larger) on every button, link and option.
- Colours come only from the theme tokens in `src/index.css` (`projects`, `patterns`, `stash`, `timer`, `ink`, `muted`, `line`, `surface`, …). The only exception is the twelve colour-family swatch hex values, defined once in `src/lib/colours.ts`.
- Copy (labels, buttons, messages, aria-labels) is exactly as written in the task; tests and the end-to-end test match on it.
- Every new table has `id uuid primary key default gen_random_uuid()`, `user_id uuid not null default auth.uid() references auth.users on delete cascade`, `created_at`, `updated_at`, row-level security with policy `owner_all` (`user_id = auth.uid()`), and the `set_updated_at` trigger.
- Every mutation calls `useInvalidateAll()` on success; Phase 1.2 adds the root query key `'lists'`.
- After changing SQL: `npm run db:reset` then `npm run db:types` (local stack on ports 554xx; start it with `npm run db:start` if needed). Never run `npm run db:push`.
- Never read, print, modify or stage `.env` or `.env.test`.
- Tests: `npx vitest run` (unit/UI), `npm run test:db` (database, needs the local stack), `npm run e2e` (end-to-end), `npm run build` (type check + build).
- Every commit message ends with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20261012000001_phase_1_2.sql` | All schema, trigger and function changes |
| `supabase/tests/phase_1_2.test.ts` | Database tests for the migration |
| `src/lib/colours.ts` | Colour families: values, labels, swatch hex |
| `src/components/ColourDots.tsx` | Row of colour-family dots (pick / filter, tap again to clear) |
| `src/components/SuggestField.tsx` | Text field with a tap-friendly suggestion list |
| `src/features/lists/parse.ts` | `parseYarnList`, `parseNameList`, `importSummary` |
| `src/features/lists/api.ts` | Queries and mutations for catalog, shops, fibers, import |
| `src/features/lists/ManageListsPage.tsx` | `/stash/lists` page |
| `src/features/stash/YarnForm.tsx` | Suggestions, colour family, fiber dropdown |
| `src/features/stash/logic.ts`, `StashList.tsx` | Search + colour filter |
| `src/features/materials/logic.ts` | Material drafts, cleaning, generic `planRows` |
| `src/features/materials/MaterialsSection.tsx` | Pattern form section |
| `src/features/materials/MaterialsList.tsx` | Pattern page display |
| `src/features/projects/YarnPicker.tsx` | Pick a stash yarn with colour dots + search |
| `src/features/projects/StartProjectPage.tsx` | `/patterns/:id/start` page |
| `src/features/projects/patternDiff.ts` | `diffProjectWithPattern`, `toRpcChanges` |
| `src/features/projects/UpdateFromPattern.tsx` | Preview panel on the project page |

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20261012000001_phase_1_2.sql`
- Create: `supabase/tests/phase_1_2.test.ts`
- Modify: `src/lib/database.types.ts` (regenerated, do not edit by hand)
- Modify: `src/lib/invalidate.ts`, `src/lib/invalidate.test.tsx`

**Interfaces:**
- Produces (SQL): enum `colour_family`; `yarns.color_family`; tables `catalog_yarns(brand, name, yarn_weight, fiber)`, `shops(name)`, `fibers(name)`, `pattern_yarns(pattern_id, position, color, color_family, skeins, yarn_type)`, `pattern_materials(pattern_id, position, name, quantity)`; `parts.from_pattern`; RPCs `import_lists(p_yarns jsonb, p_shops jsonb, p_fibers jsonb) returns jsonb {added, skipped}`, `start_project_from_pattern(p_pattern_id uuid, p_plans jsonb default '[]') returns uuid`, `apply_pattern_update(p_project_id uuid, p_changes jsonb) returns void`.
- `p_plans` elements: `{ "yarn_id": uuid, "skeins": number }`.
- `p_changes` elements: `{ "kind": "add", "pattern_part_id": uuid, "name": text, "total_rows": int|null, "after_part_id": uuid|null }`, `{ "kind": "rename", "part_id": uuid, "name": text }`, `{ "kind": "rows", "part_id": uuid, "total_rows": int|null }`, `{ "kind": "delete", "part_id": uuid }`.
- Produces (TS): root query key `'lists'` in `useInvalidateAll`.

- [ ] **Step 1: Write the failing database tests**

Create `supabase/tests/phase_1_2.test.ts`:

```ts
import { createTestUser, deleteTestUser, type TestUser } from './helpers';

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

async function yarn(fields: Record<string, unknown>, client = u.client) {
  const { data, error } = await client.from('yarns').insert({ skeins_owned: 3, ...fields }).select().single();
  if (error) throw error;
  return data;
}

describe('lists', () => {
  test('saving a yarn fills the lists once, ignoring case', async () => {
    await yarn({ brand: 'Hobbii', name: 'Honey Bunny', yarn_weight: 'super_bulky', fiber: 'Polyester', bought_at: 'Hobbii' });
    await yarn({ brand: 'hobbii', name: 'honey bunny', fiber: 'polyester', bought_at: 'HOBBII' });
    await yarn({ name: 'No brand', fiber: 'Coton' });

    const cat = await u.client.from('catalog_yarns').select().order('created_at');
    expect(cat.data!.map((c) => [c.brand, c.name, c.yarn_weight, c.fiber]))
      .toEqual([['Hobbii', 'Honey Bunny', 'super_bulky', 'Polyester']]);
    const shops = await u.client.from('shops').select('name');
    expect(shops.data!.map((s) => s.name)).toEqual(['Hobbii']);
    const fibers = await u.client.from('fibers').select('name').order('name');
    expect(fibers.data!.map((f) => f.name)).toEqual(['Coton', 'Polyester']);
  });

  test('lists are private and unique per user (case-insensitive)', async () => {
    const a = await u.client.from('shops').insert({ name: 'Wool Shop' });
    expect(a.error).toBeNull();
    const dup = await u.client.from('shops').insert({ name: 'wool shop' });
    expect(dup.error?.code).toBe('23505');
    const theirs = await other.client.from('shops').insert({ name: 'Wool Shop' });
    expect(theirs.error).toBeNull();
    const seen = await other.client.from('shops').select('name');
    expect(seen.data!.map((s) => s.name)).toEqual(['Wool Shop']);
  });

  test('import_lists adds new entries, skips existing ones and adds fibers from yarn lines', async () => {
    const { data, error } = await u.client.rpc('import_lists', {
      p_yarns: [
        { brand: 'Hobbii', name: 'Baby Snuggle', yarn_weight: 'super_bulky', fiber: 'Polyester' },
        { brand: 'HOBBII', name: 'honey bunny', yarn_weight: null, fiber: null },
        { brand: 'Drops', name: 'Paris', yarn_weight: 'dk', fiber: 'Coton bio' },
      ],
      p_shops: ['Hobbii', 'Wool Warehouse'],
      p_fibers: ['Soie', 'polyester'],
    });
    expect(error).toBeNull();
    expect(data).toEqual({ added: 4, skipped: 3 });
    const fibers = await u.client.from('fibers').select('name').order('name');
    expect(fibers.data!.map((f) => f.name)).toEqual(['Coton', 'Coton bio', 'Polyester', 'Soie']);
  });
});

async function patternWithParts(parts: { name: string; count: number; total_rows?: number }[]) {
  const { data: pattern, error } = await u.client.from('patterns').insert({ name: 'T-rex' }).select().single();
  if (error) throw error;
  const { data: pp, error: e2 } = await u.client.from('pattern_parts')
    .insert(parts.map((p, i) => ({ ...p, pattern_id: pattern.id, position: i }))).select().order('position');
  if (e2) throw e2;
  return { pattern, pp };
}

describe('pattern materials', () => {
  test('owner-only, deleted with the pattern', async () => {
    const { pattern } = await patternWithParts([{ name: 'Head', count: 1 }]);
    const y = await u.client.from('pattern_yarns').insert({ pattern_id: pattern.id, color: 'Pink', color_family: 'pink', skeins: 2 });
    expect(y.error).toBeNull();
    const m = await u.client.from('pattern_materials').insert({ pattern_id: pattern.id, name: 'Safety eyes 10 mm', quantity: 2 });
    expect(m.error).toBeNull();
    const blank = await u.client.from('pattern_yarns').insert({ pattern_id: pattern.id, color: '  ' });
    expect(blank.error).not.toBeNull();
    const seen = await other.client.from('pattern_yarns').select().eq('pattern_id', pattern.id);
    expect(seen.data).toEqual([]);
    await u.client.from('patterns').delete().eq('id', pattern.id);
    const left = await u.client.from('pattern_materials').select().eq('pattern_id', pattern.id);
    expect(left.data).toEqual([]);
  });
});

describe('start_project_from_pattern with plans', () => {
  test('marks copied parts and plans yarns, summing the same yarn', async () => {
    const { pattern } = await patternWithParts([{ name: 'Leg', count: 2 }]);
    const pink = await yarn({ name: 'Honey Bunny' });
    const white = await yarn({ name: 'Toucan' });
    const { data: projectId, error } = await u.client.rpc('start_project_from_pattern', {
      p_pattern_id: pattern.id,
      p_plans: [{ yarn_id: pink.id, skeins: 2 }, { yarn_id: pink.id, skeins: 0.5 }, { yarn_id: white.id, skeins: 1 }],
    });
    expect(error).toBeNull();
    const parts = await u.client.from('parts').select('name, from_pattern').eq('project_id', projectId).order('position');
    expect(parts.data).toEqual([{ name: 'Leg 1', from_pattern: true }, { name: 'Leg 2', from_pattern: true }]);
    const plans = await u.client.from('project_yarns').select('yarn_id, skeins_planned').eq('project_id', projectId);
    expect(new Map(plans.data!.map((p) => [p.yarn_id, Number(p.skeins_planned)])))
      .toEqual(new Map([[pink.id, 2.5], [white.id, 1]]));
  });

  test('a yarn that is not yours creates no project', async () => {
    const { pattern } = await patternWithParts([{ name: 'Body', count: 1 }]);
    const theirs = await yarn({ name: 'Theirs' }, other.client);
    const before = await u.client.from('projects').select('id');
    const { error } = await u.client.rpc('start_project_from_pattern', {
      p_pattern_id: pattern.id, p_plans: [{ yarn_id: theirs.id, skeins: 1 }],
    });
    expect(error).not.toBeNull();
    const after = await u.client.from('projects').select('id');
    expect(after.data!.length).toBe(before.data!.length);
  });

  test('works without plans', async () => {
    const { pattern } = await patternWithParts([{ name: 'Body', count: 1 }]);
    const { error } = await u.client.rpc('start_project_from_pattern', { p_pattern_id: pattern.id });
    expect(error).toBeNull();
  });
});

describe('apply_pattern_update', () => {
  async function project() {
    const { pattern, pp } = await patternWithParts([{ name: 'Head', count: 1, total_rows: 24 }, { name: 'Leg', count: 1 }, { name: 'Tail', count: 1 }]);
    const { data: projectId } = await u.client.rpc('start_project_from_pattern', { p_pattern_id: pattern.id });
    const { data: parts } = await u.client.from('parts').select().eq('project_id', projectId).order('position');
    return { projectId: projectId as string, pp, parts: parts! };
  }

  test('adds after an anchor in order, renames, changes rows and deletes; keeps work', async () => {
    const { projectId, pp, parts } = await project();
    const [head, leg, tail] = parts;
    await u.client.from('parts').update({ current_row: 7 }).eq('id', head.id);
    await u.client.from('time_sessions').insert({ part_id: head.id, started_at: '2026-01-01T10:00:00Z', ended_at: '2026-01-01T11:00:00Z' });

    const { error } = await u.client.rpc('apply_pattern_update', {
      p_project_id: projectId,
      p_changes: [
        { kind: 'rename', part_id: leg.id, name: 'Leg 1' },
        { kind: 'add', pattern_part_id: pp[1].id, name: 'Leg 2', total_rows: null, after_part_id: leg.id },
        { kind: 'add', pattern_part_id: pp[1].id, name: 'Leg 3', total_rows: null, after_part_id: leg.id },
        { kind: 'rows', part_id: head.id, total_rows: 28 },
        { kind: 'delete', part_id: tail.id },
      ],
    });
    expect(error).toBeNull();
    const after = await u.client.from('parts').select('name, total_rows, current_row, from_pattern').eq('project_id', projectId).order('position');
    expect(after.data).toEqual([
      { name: 'Head', total_rows: 28, current_row: 7, from_pattern: true },
      { name: 'Leg 1', total_rows: null, current_row: null, from_pattern: true },
      { name: 'Leg 2', total_rows: null, current_row: null, from_pattern: true },
      { name: 'Leg 3', total_rows: null, current_row: null, from_pattern: true },
    ]);
    const sessions = await u.client.from('time_sessions').select().eq('part_id', head.id);
    expect(sessions.data!.length).toBe(1);
  });

  test('a part of another project changes nothing', async () => {
    const a = await project();
    const b = await project();
    const { error } = await u.client.rpc('apply_pattern_update', {
      p_project_id: a.projectId,
      p_changes: [{ kind: 'rename', part_id: a.parts[0].id, name: 'Renamed' }, { kind: 'delete', part_id: b.parts[0].id }],
    });
    expect(error).not.toBeNull();
    const still = await u.client.from('parts').select('name').eq('id', a.parts[0].id).single();
    expect(still.data!.name).toBe('Head');
  });
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npm run test:db -- supabase/tests/phase_1_2.test.ts`
Expected: FAIL (`relation "public.catalog_yarns" does not exist`, unknown function `import_lists`, …).

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20261012000001_phase_1_2.sql`:

```sql
-- Phase 1.2: yarn lists (catalog, shops, fibers), colour families, pattern materials,
-- yarn plans when starting a project, and "update from pattern".

create type public.colour_family as enum
  ('red', 'pink', 'orange', 'yellow', 'green', 'blue', 'purple', 'brown', 'grey', 'black', 'white', 'multicolour');

alter table public.yarns add column color_family public.colour_family;

-- The user's lists. Suggestions come only from these; saving a yarn adds to them.
create table public.catalog_yarns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  brand text not null check (length(trim(brand)) > 0),
  name text not null check (length(trim(name)) > 0),
  yarn_weight public.yarn_weight,
  fiber text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index catalog_yarns_unique on public.catalog_yarns (user_id, lower(brand), lower(name));

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index shops_unique on public.shops (user_id, lower(name));

create table public.fibers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index fibers_unique on public.fibers (user_id, lower(name));

-- Materials of a pattern: one line per yarn colour, and other materials
create table public.pattern_yarns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  pattern_id uuid not null references public.patterns on delete cascade,
  position int not null default 0,
  color text not null check (length(trim(color)) > 0),
  color_family public.colour_family,
  skeins numeric(6,2) check (skeins >= 0),
  yarn_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.pattern_yarns (pattern_id);

create table public.pattern_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  pattern_id uuid not null references public.patterns on delete cascade,
  position int not null default 0,
  name text not null check (length(trim(name)) > 0),
  quantity numeric(6,2) check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.pattern_materials (pattern_id);

alter table public.catalog_yarns enable row level security;
create policy owner_all on public.catalog_yarns for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger set_updated_at before update on public.catalog_yarns
  for each row execute function public.set_updated_at();

alter table public.shops enable row level security;
create policy owner_all on public.shops for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger set_updated_at before update on public.shops
  for each row execute function public.set_updated_at();

alter table public.fibers enable row level security;
create policy owner_all on public.fibers for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger set_updated_at before update on public.fibers
  for each row execute function public.set_updated_at();

alter table public.pattern_yarns enable row level security;
create policy owner_all on public.pattern_yarns for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger set_updated_at before update on public.pattern_yarns
  for each row execute function public.set_updated_at();

alter table public.pattern_materials enable row level security;
create policy owner_all on public.pattern_materials for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create trigger set_updated_at before update on public.pattern_materials
  for each row execute function public.set_updated_at();

-- Saving a yarn adds its brand + name, shop and fiber to the lists (existing entries are left alone).
create function public.add_yarn_to_lists() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if nullif(trim(new.brand), '') is not null then
    insert into public.catalog_yarns (user_id, brand, name, yarn_weight, fiber)
    values (new.user_id, trim(new.brand), trim(new.name), new.yarn_weight, nullif(trim(new.fiber), ''))
    on conflict do nothing;
  end if;
  if nullif(trim(new.bought_at), '') is not null then
    insert into public.shops (user_id, name) values (new.user_id, trim(new.bought_at)) on conflict do nothing;
  end if;
  if nullif(trim(new.fiber), '') is not null then
    insert into public.fibers (user_id, name) values (new.user_id, trim(new.fiber)) on conflict do nothing;
  end if;
  return new;
end $$;

create trigger add_yarn_to_lists after insert or update of brand, name, yarn_weight, fiber, bought_at on public.yarns
  for each row execute function public.add_yarn_to_lists();

-- Seed the lists once from the yarns already in the stash
insert into public.catalog_yarns (user_id, brand, name, yarn_weight, fiber)
select distinct on (user_id, lower(trim(brand)), lower(trim(name)))
  user_id, trim(brand), trim(name), yarn_weight, nullif(trim(fiber), '')
from public.yarns
where nullif(trim(brand), '') is not null
order by user_id, lower(trim(brand)), lower(trim(name)), updated_at desc;

insert into public.shops (user_id, name)
select distinct on (user_id, lower(trim(bought_at))) user_id, trim(bought_at)
from public.yarns
where nullif(trim(bought_at), '') is not null
order by user_id, lower(trim(bought_at));

insert into public.fibers (user_id, name)
select distinct on (user_id, lower(trim(fiber))) user_id, trim(fiber)
from public.yarns
where nullif(trim(fiber), '') is not null
order by user_id, lower(trim(fiber));

-- Paste a list: returns how many entries were added and how many were already there.
create function public.import_lists(p_yarns jsonb default '[]', p_shops jsonb default '[]', p_fibers jsonb default '[]')
returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  e jsonb;
  n int;
  v_added int := 0;
  v_skipped int := 0;
begin
  for e in select * from jsonb_array_elements(p_yarns) loop
    insert into public.catalog_yarns (brand, name, yarn_weight, fiber)
    values (trim(e->>'brand'), trim(e->>'name'), (e->>'yarn_weight')::public.yarn_weight, nullif(trim(e->>'fiber'), ''))
    on conflict do nothing;
    get diagnostics n = row_count;
    v_added := v_added + n;
    v_skipped := v_skipped + 1 - n;
    if nullif(trim(e->>'fiber'), '') is not null then
      insert into public.fibers (name) values (trim(e->>'fiber')) on conflict do nothing;
    end if;
  end loop;
  for e in select * from jsonb_array_elements(p_shops) loop
    insert into public.shops (name) values (trim(e #>> '{}')) on conflict do nothing;
    get diagnostics n = row_count;
    v_added := v_added + n;
    v_skipped := v_skipped + 1 - n;
  end loop;
  for e in select * from jsonb_array_elements(p_fibers) loop
    insert into public.fibers (name) values (trim(e #>> '{}')) on conflict do nothing;
    get diagnostics n = row_count;
    v_added := v_added + n;
    v_skipped := v_skipped + 1 - n;
  end loop;
  return jsonb_build_object('added', v_added, 'skipped', v_skipped);
end $$;

-- Project parts remember whether they came from the pattern (the link itself is lost when the
-- pattern part is deleted, and "removed from the pattern" must differ from "added by hand").
alter table public.parts add column from_pattern boolean not null default false;
update public.parts set from_pattern = true where pattern_part_id is not null;

-- start_project_from_pattern: same as 20261008000001 plus from_pattern and optional yarn plans
drop function public.start_project_from_pattern(uuid);
create function public.start_project_from_pattern(p_pattern_id uuid, p_plans jsonb default '[]') returns uuid
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
  -- Only yarns the user can see (row-level security) may be planned
  if exists (
    select 1 from jsonb_array_elements(p_plans) e
    where not exists (select 1 from public.yarns y where y.id = (e->>'yarn_id')::uuid)
  ) then
    raise exception 'yarn not found' using errcode = 'P0002';
  end if;

  insert into public.projects (name, pattern_id, status, start_date, hook_size_mm)
  values (v_pattern.name, v_pattern.id, 'in_progress', current_date, v_pattern.hook_size_mm)
  returning id into v_project;

  for v_part in
    select id, name, count, total_rows from public.pattern_parts
    where pattern_id = p_pattern_id order by position, created_at
  loop
    for i in 1..v_part.count loop
      insert into public.parts (project_id, name, position, total_rows, pattern_part_id, from_pattern)
      values (
        v_project,
        case when v_part.count = 1 then v_part.name else v_part.name || ' ' || i end,
        v_pos,
        v_part.total_rows,
        v_part.id,
        true
      );
      v_pos := v_pos + 1;
    end loop;
  end loop;

  if v_pos = 0 then
    insert into public.parts (project_id, name, position) values (v_project, 'Main', 0);
  end if;

  insert into public.project_yarns (project_id, yarn_id, skeins_planned)
  select v_project, (e->>'yarn_id')::uuid, sum(coalesce((e->>'skeins')::numeric, 0))
  from jsonb_array_elements(p_plans) e
  group by (e->>'yarn_id')::uuid;

  return v_project;
end $$;

-- Apply the ticked changes of "Update from pattern" in one transaction.
create function public.apply_pattern_update(p_project_id uuid, p_changes jsonb) returns void
language plpgsql security invoker set search_path = public as $$
declare
  c jsonb;
  v_anchor uuid;
  v_pos int;
  v_new uuid;
  v_last jsonb := '{}';  -- anchor part id → last part added after it, so several adds keep their order
begin
  if not exists (select 1 from public.projects where id = p_project_id) then
    raise exception 'project % not found', p_project_id using errcode = 'P0002';
  end if;

  for c in select * from jsonb_array_elements(p_changes) loop
    case c->>'kind'
      when 'rename' then
        update public.parts set name = c->>'name' where id = (c->>'part_id')::uuid and project_id = p_project_id;
        if not found then raise exception 'part % is not in this project', c->>'part_id' using errcode = 'P0002'; end if;
      when 'rows' then
        update public.parts set total_rows = (c->>'total_rows')::int where id = (c->>'part_id')::uuid and project_id = p_project_id;
        if not found then raise exception 'part % is not in this project', c->>'part_id' using errcode = 'P0002'; end if;
      when 'delete' then
        delete from public.parts where id = (c->>'part_id')::uuid and project_id = p_project_id;
        if not found then raise exception 'part % is not in this project', c->>'part_id' using errcode = 'P0002'; end if;
      when 'add' then
        v_anchor := coalesce((v_last->>(c->>'after_part_id'))::uuid, (c->>'after_part_id')::uuid);
        if v_anchor is null then
          select coalesce(max(position) + 1, 0) into v_pos from public.parts where project_id = p_project_id;
        else
          select position + 1 into v_pos from public.parts where id = v_anchor and project_id = p_project_id;
          if not found then raise exception 'part % is not in this project', v_anchor using errcode = 'P0002'; end if;
          update public.parts set position = position + 1 where project_id = p_project_id and position >= v_pos;
        end if;
        insert into public.parts (project_id, name, position, total_rows, pattern_part_id, from_pattern)
        values (p_project_id, c->>'name', v_pos, (c->>'total_rows')::int, (c->>'pattern_part_id')::uuid, true)
        returning id into v_new;
        if c->>'after_part_id' is not null then
          v_last := v_last || jsonb_build_object(c->>'after_part_id', v_new);
        end if;
      else
        raise exception 'unknown change %', c->>'kind' using errcode = '22023';
    end case;
  end loop;
end $$;
```

- [ ] **Step 4: Apply it, regenerate types, run the database tests**

Run: `npm run db:reset` then `npm run db:types` then `npm run test:db`
Expected: all database test files PASS (Phase 1 + 1.1 + the new file). If an older test calls `start_project_from_pattern` with one argument, it still passes (the second argument has a default).

- [ ] **Step 5: Add the `lists` query root**

In `src/lib/invalidate.ts` change the keys line to:

```ts
const ROOT_KEYS = ['projects', 'parts', 'timer', 'yarns', 'patterns', 'pattern-types', 'instructions', 'lists'] as const;
```

In `src/lib/invalidate.test.tsx` change the expected list to:

```ts
  expect(keys.sort()).toEqual(['instructions', 'lists', 'parts', 'pattern-types', 'patterns', 'projects', 'timer', 'yarns']);
```

- [ ] **Step 6: Type check and unit tests**

Run: `npm run build` then `npx vitest run`
The new `yarns.color_family` column makes `YarnInput` require it, so first make these two source edits:
- `src/features/stash/YarnForm.tsx`: in the `empty` object add `color_family: null,` after `color: null,`.
- `src/features/stash/api.ts`: in `toYarnInput` add `color_family: y.color_family,` after `color: y.color,`.

Expected: build succeeds; all tests PASS. If the build reports a missing `color_family` on a yarn literal in a test fixture (e.g. `src/features/stash/logic.test.ts`, `StashList.test.tsx`, `YarnPage.test.tsx`), add `color_family: null` to that fixture. If it reports `from_pattern` missing on a part fixture, add `from_pattern: false`.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20261012000001_phase_1_2.sql supabase/tests/phase_1_2.test.ts src
git commit -m "feat: database for yarn lists, colour families, pattern materials and pattern updates

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Shared pieces — colour families, ColourDots, SuggestField

**Files:**
- Create: `src/lib/colours.ts`
- Create: `src/components/ColourDots.tsx`, `src/components/ColourDots.test.tsx`
- Create: `src/components/SuggestField.tsx`, `src/components/SuggestField.test.tsx`

**Interfaces:**
- Consumes: `Database['public']['Enums']['colour_family']` from the regenerated `src/lib/database.types.ts` (Task 1).
- Produces:
  - `type ColourFamily` and `COLOUR_FAMILIES: { value: ColourFamily; label: string; hex: string }[]`, `colourLabel(f: ColourFamily | null): string`, `colourHex(f: ColourFamily): string` in `src/lib/colours.ts`.
  - `<ColourDots label value onChange families? />` — `label: string` (radiogroup name), `value: ColourFamily | null`, `onChange(v: ColourFamily | null)`, `families?: ColourFamily[]` (defaults to all twelve). Each dot is a `role="radio"` button named by its colour label ("Pink"); tapping the selected dot calls `onChange(null)`.
  - `<SuggestField label value onChange suggestions onPick? required? inputClassName? />` — `label: string` (visible label and input name), `value: string`, `onChange(v: string)`, `suggestions: string[]`, `onPick?(v: string)`. Shows up to 8 matching suggestions in a `role="listbox"` named `"{label} suggestions"`, each a `role="option"` button.

- [ ] **Step 1: Write the failing tests**

Create `src/components/ColourDots.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ColourDots from './ColourDots';

test('picks a family and clears it when tapped again', async () => {
  const onChange = vi.fn();
  const { rerender } = render(<ColourDots label="Colour family" value={null} onChange={onChange} />);
  expect(screen.getAllByRole('radio')).toHaveLength(12);
  await userEvent.click(screen.getByRole('radio', { name: 'Pink' }));
  expect(onChange).toHaveBeenLastCalledWith('pink');
  rerender(<ColourDots label="Colour family" value="pink" onChange={onChange} />);
  expect(screen.getByRole('radio', { name: 'Pink' })).toHaveAttribute('aria-checked', 'true');
  await userEvent.click(screen.getByRole('radio', { name: 'Pink' }));
  expect(onChange).toHaveBeenLastCalledWith(null);
});

test('can show only some families', () => {
  render(<ColourDots label="Colour" value={null} onChange={() => {}} families={['green', 'blue']} />);
  expect(screen.getAllByRole('radio').map((r) => r.getAttribute('aria-label'))).toEqual(['Green', 'Blue']);
});
```

Create `src/components/SuggestField.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import SuggestField from './SuggestField';

function Harness({ suggestions, onPick }: { suggestions: string[]; onPick?: (v: string) => void }) {
  const [v, setV] = useState('');
  return <SuggestField label="Brand" value={v} onChange={setV} suggestions={suggestions} onPick={onPick} />;
}

test('shows matching suggestions while typing and fills the field on pick', async () => {
  const onPick = vi.fn();
  render(<Harness suggestions={['Hobbii', 'Drops', 'Scheepjes']} onPick={onPick} />);
  await userEvent.type(screen.getByLabelText('Brand'), 'ob');
  const list = screen.getByRole('listbox', { name: 'Brand suggestions' });
  expect(list).toHaveTextContent('Hobbii');
  expect(list).not.toHaveTextContent('Drops');
  await userEvent.click(screen.getByRole('option', { name: 'Hobbii' }));
  expect(screen.getByLabelText('Brand')).toHaveValue('Hobbii');
  expect(onPick).toHaveBeenCalledWith('Hobbii');
  expect(screen.queryByRole('listbox')).toBeNull();
});

test('shows at most 8 and hides an exact match', async () => {
  const many = Array.from({ length: 12 }, (_, i) => `Yarn ${i + 1}`);
  render(<Harness suggestions={many} />);
  await userEvent.click(screen.getByLabelText('Brand'));
  expect(screen.getAllByRole('option')).toHaveLength(8);
  await userEvent.type(screen.getByLabelText('Brand'), 'Yarn 12');
  expect(screen.queryByRole('listbox')).toBeNull();
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run src/components/ColourDots.test.tsx src/components/SuggestField.test.tsx`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

Create `src/lib/colours.ts`:

```ts
import type { Database } from './database.types';

export type ColourFamily = Database['public']['Enums']['colour_family'];

/** The twelve colour families. The hex values are swatches only, used nowhere else. */
export const COLOUR_FAMILIES: { value: ColourFamily; label: string; hex: string }[] = [
  { value: 'red', label: 'Red', hex: '#D64545' },
  { value: 'pink', label: 'Pink', hex: '#F28DB2' },
  { value: 'orange', label: 'Orange', hex: '#F39237' },
  { value: 'yellow', label: 'Yellow', hex: '#F6D743' },
  { value: 'green', label: 'Green', hex: '#4CAF50' },
  { value: 'blue', label: 'Blue', hex: '#4A90E2' },
  { value: 'purple', label: 'Purple', hex: '#8E5CC4' },
  { value: 'brown', label: 'Brown', hex: '#8B5A3C' },
  { value: 'grey', label: 'Grey', hex: '#9E9E9E' },
  { value: 'black', label: 'Black', hex: '#222222' },
  { value: 'white', label: 'White', hex: '#FFFFFF' },
  { value: 'multicolour', label: 'Multicolour', hex: 'conic-gradient(#D64545, #F6D743, #4CAF50, #4A90E2, #8E5CC4, #D64545)' },
];

export function colourLabel(f: ColourFamily | null): string {
  return COLOUR_FAMILIES.find((c) => c.value === f)?.label ?? '';
}

/** CSS `background` for a family's swatch. */
export function colourHex(f: ColourFamily): string {
  return COLOUR_FAMILIES.find((c) => c.value === f)!.hex;
}
```

Create `src/components/ColourDots.tsx`:

```tsx
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
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${on ? 'ring-2 ring-ink' : ''}`}>
            <span className="h-7 w-7 rounded-full border border-line" style={{ background: c.hex }} />
          </button>
        );
      })}
    </div>
  );
}
```

Create `src/components/SuggestField.tsx`:

```tsx
import { useId, useState } from 'react';

type Props = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  onPick?: (v: string) => void;
  required?: boolean;
  inputClassName?: string;
};

const MAX = 8;

/**
 * A text field with a tap-friendly suggestion list (iOS shows <datalist> poorly).
 * Suggestions match anywhere, ignoring case; an exact match is not repeated.
 */
export default function SuggestField({ label, value, onChange, suggestions, onPick, required, inputClassName }: Props) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const q = value.trim().toLowerCase();
  const shown = [...new Set(suggestions)]
    .filter((s) => s.toLowerCase().includes(q) && s.toLowerCase() !== q)
    .slice(0, MAX);

  function pick(s: string) {
    onChange(s);
    onPick?.(s);
    setOpen(false);
  }

  return (
    <div className="relative flex flex-col gap-1.5 text-sm text-muted">
      <label htmlFor={id}>{label}</label>
      <input id={id} required={required} value={value} autoComplete="off"
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        className={inputClassName ?? 'h-12 rounded-xl border border-line bg-surface px-3 text-ink'} />
      {open && shown.length > 0 && (
        <div role="listbox" aria-label={`${label} suggestions`}
          className="absolute inset-x-0 top-full z-20 mt-1 flex flex-col overflow-hidden rounded-xl border border-line bg-surface text-ink shadow">
          {shown.map((s) => (
            <button key={s} type="button" role="option" aria-selected={false}
              // Keep the input focused so the tap lands on the option before blur closes the list.
              onPointerDown={(e) => e.preventDefault()} onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(s)}
              className="min-h-11 border-b border-divider px-3 text-left last:border-b-0">
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/components/ColourDots.test.tsx src/components/SuggestField.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/colours.ts src/components/ColourDots.tsx src/components/ColourDots.test.tsx src/components/SuggestField.tsx src/components/SuggestField.test.tsx
git commit -m "feat: colour family dots and a suggestion field

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Lists — paste parser, API and the Manage lists page

**Files:**
- Create: `src/features/lists/parse.ts`, `src/features/lists/parse.test.ts`
- Create: `src/features/lists/api.ts`
- Create: `src/features/lists/ManageListsPage.tsx`, `src/features/lists/ManageListsPage.test.tsx`
- Modify: `src/App.tsx` (route), `src/features/stash/StashList.tsx` (link)

**Interfaces:**
- Consumes: tables `catalog_yarns`, `shops`, `fibers`, RPC `import_lists` (Task 1); `WEIGHTS` from `src/lib/labels.ts`; `ConfirmDialog`, `ErrorBox`.
- Produces:
  - `type CatalogLine = { brand: string; name: string; yarn_weight: YarnWeight | null; fiber: string | null }`
  - `parseYarnList(text: string): { entries: CatalogLine[]; rejected: number[] }` (1-based line numbers)
  - `parseNameList(text: string): string[]`
  - `importSummary(r: { added: number; skipped: number }, rejected: number[]): string`
  - `type CatalogYarn = Tables<'catalog_yarns'>`, `type ListEntry = Tables<'shops'>` (fibers have the same shape)
  - `useCatalog()`, `useShops()`, `useFibers()` — queries with keys `['lists', 'catalog']`, `['lists', 'shops']`, `['lists', 'fibers']`, sorted by name (catalog by brand then name)
  - `useImportLists()` — mutation `{ yarns?: CatalogLine[]; shops?: string[]; fibers?: string[] } → { added: number; skipped: number }`
  - `useRenameListEntry()` — mutation `{ table: 'catalog_yarns' | 'shops' | 'fibers'; id: string; patch: { name?: string; brand?: string } }`
  - `useDeleteListEntry()` — mutation `{ table; id }`
  - Route `/stash/lists`; link "Manage lists" on the Stash page.

- [ ] **Step 1: Write the failing parser tests**

Create `src/features/lists/parse.test.ts`:

```ts
import { importSummary, parseNameList, parseYarnList } from './parse';

test("parses the user's yarn lines", () => {
  const text = [
    'Hobbii ; Honey Bunny ; Super Bulky ; Polyester',
    'Hobbii ; Baby Snuggle ; Super Bulky ; Polyester',
    'Hobbii ; Toucan ; Super Bulky ; Polyester',
  ].join('\n');
  expect(parseYarnList(text)).toEqual({
    entries: [
      { brand: 'Hobbii', name: 'Honey Bunny', yarn_weight: 'super_bulky', fiber: 'Polyester' },
      { brand: 'Hobbii', name: 'Baby Snuggle', yarn_weight: 'super_bulky', fiber: 'Polyester' },
      { brand: 'Hobbii', name: 'Toucan', yarn_weight: 'super_bulky', fiber: 'Polyester' },
    ],
    rejected: [],
  });
});

test('weight and fiber are optional; blank lines are skipped; duplicates kept once', () => {
  const text = 'Drops ; Paris ; dk ;\n\nScheepjes ; Catona\n  drops;paris;DK;Coton  \n';
  expect(parseYarnList(text)).toEqual({
    entries: [
      { brand: 'Drops', name: 'Paris', yarn_weight: 'dk', fiber: null },
      { brand: 'Scheepjes', name: 'Catona', yarn_weight: null, fiber: null },
    ],
    rejected: [],
  });
});

test('lines without brand and name, or with an unknown weight, are rejected by number', () => {
  const text = 'Hobbii\nHobbii ; Toucan ; Chunky ; Polyester\n ; Paris\nDrops ; Safran ; Sport ; Coton';
  expect(parseYarnList(text)).toEqual({
    entries: [{ brand: 'Drops', name: 'Safran', yarn_weight: 'sport', fiber: 'Coton' }],
    rejected: [1, 2, 3],
  });
});

test('parseNameList trims, skips blanks and keeps the first spelling of duplicates', () => {
  expect(parseNameList('Coton\n polyester \n\nPolyester\nLaine de mérinos')).toEqual(['Coton', 'polyester', 'Laine de mérinos']);
});

test('importSummary', () => {
  expect(importSummary({ added: 3, skipped: 1 }, [])).toBe('3 added, 1 already there');
  expect(importSummary({ added: 0, skipped: 0 }, [4])).toBe('0 added, 0 already there, 1 line not understood (line 4)');
  expect(importSummary({ added: 1, skipped: 0 }, [2, 5])).toBe('1 added, 0 already there, 2 lines not understood (lines 2, 5)');
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run src/features/lists/parse.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the parser**

Create `src/features/lists/parse.ts`:

```ts
import { WEIGHTS, type YarnWeight } from '../../lib/labels';

export type CatalogLine = { brand: string; name: string; yarn_weight: YarnWeight | null; fiber: string | null };

function weightOf(text: string): YarnWeight | null | undefined {
  const t = text.trim().toLowerCase();
  if (t === '') return null;
  return WEIGHTS.find((w) => w.label.toLowerCase() === t || w.value === t)?.value; // undefined = unknown
}

/** "Brand ; Yarn name ; Weight ; Fiber" per line. Weight and fiber are optional. */
export function parseYarnList(text: string): { entries: CatalogLine[]; rejected: number[] } {
  const entries: CatalogLine[] = [];
  const rejected: number[] = [];
  const seen = new Set<string>();
  text.split(/\r?\n/).forEach((raw, i) => {
    if (raw.trim() === '') return;
    const [brand = '', name = '', weight = '', fiber = ''] = raw.split(';').map((s) => s.trim());
    const yarn_weight = weightOf(weight);
    if (brand === '' || name === '' || yarn_weight === undefined) {
      rejected.push(i + 1);
      return;
    }
    const key = `${brand.toLowerCase()}|${name.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({ brand, name, yarn_weight, fiber: fiber === '' ? null : fiber });
  });
  return { entries, rejected };
}

/** One name per line. */
export function parseNameList(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of text.split(/\r?\n/)) {
    const name = raw.trim();
    if (name === '' || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
  }
  return out;
}

export function importSummary(r: { added: number; skipped: number }, rejected: number[]): string {
  const parts = [`${r.added} added`, `${r.skipped} already there`];
  if (rejected.length === 1) parts.push(`1 line not understood (line ${rejected[0]})`);
  if (rejected.length > 1) parts.push(`${rejected.length} lines not understood (lines ${rejected.join(', ')})`);
  return parts.join(', ');
}
```

- [ ] **Step 4: Run the parser tests**

Run: `npx vitest run src/features/lists/parse.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the lists API**

Create `src/features/lists/api.ts`:

```ts
import { useMutation, useQuery } from '@tanstack/react-query';
import { useInvalidateAll } from '../../lib/invalidate';
import { supabase, type Tables } from '../../lib/supabase';
import type { CatalogLine } from './parse';

export type CatalogYarn = Tables<'catalog_yarns'>;
export type ListEntry = Tables<'shops'>;
export type ListTable = 'catalog_yarns' | 'shops' | 'fibers';

export function useCatalog() {
  return useQuery({
    queryKey: ['lists', 'catalog'],
    queryFn: async () => {
      const { data, error } = await supabase.from('catalog_yarns').select().order('brand').order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useShops() {
  return useQuery({
    queryKey: ['lists', 'shops'],
    queryFn: async () => {
      const { data, error } = await supabase.from('shops').select().order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useFibers() {
  return useQuery({
    queryKey: ['lists', 'fibers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('fibers').select().order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useImportLists() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (v: { yarns?: CatalogLine[]; shops?: string[]; fibers?: string[] }) => {
      const { data, error } = await supabase.rpc('import_lists', {
        p_yarns: v.yarns ?? [], p_shops: v.shops ?? [], p_fibers: v.fibers ?? [],
      });
      if (error) throw error;
      return data as { added: number; skipped: number };
    },
    onSuccess: invalidate,
  });
}

/** Names are unique per user; turn the database's unique violation into a readable message. */
function listError(error: { code?: string }) {
  return error.code === '23505' ? new Error('That name is already in the list.') : error;
}

export function useRenameListEntry() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async ({ table, id, patch }: { table: ListTable; id: string; patch: { name?: string; brand?: string } }) => {
      const clean = Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, v?.trim()]));
      const { error } = await supabase.from(table).update(clean).eq('id', id);
      if (error) throw listError(error);
    },
    onSuccess: invalidate,
  });
}

export function useDeleteListEntry() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async ({ table, id }: { table: ListTable; id: string }) => {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
```

- [ ] **Step 6: Write the failing page test**

Create `src/features/lists/ManageListsPage.test.tsx`:

```tsx
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import ManageListsPage from './ManageListsPage';

const importLists = vi.fn();
const rename = vi.fn();
const remove = vi.fn();
const entry = { user_id: 'u', created_at: '', updated_at: '' };
vi.mock('./api', () => ({
  useCatalog: () => ({ data: [
    { ...entry, id: 'c1', brand: 'Hobbii', name: 'Honey Bunny', yarn_weight: 'super_bulky', fiber: 'Polyester' },
    { ...entry, id: 'c2', brand: 'Hobbii', name: 'Toucan', yarn_weight: null, fiber: null },
  ] }),
  useShops: () => ({ data: [{ ...entry, id: 's1', name: 'Hobbii' }] }),
  useFibers: () => ({ data: [{ ...entry, id: 'f1', name: 'Coton' }] }),
  useImportLists: () => ({ mutate: importLists, isPending: false, error: null }),
  useRenameListEntry: () => ({ mutate: rename, isPending: false, error: null }),
  useDeleteListEntry: () => ({ mutate: remove, isPending: false, error: null }),
}));

beforeEach(() => { importLists.mockReset(); rename.mockReset(); remove.mockReset(); });

test('shows the three lists, yarns grouped by brand', () => {
  renderWithProviders(<ManageListsPage />);
  const yarns = screen.getByRole('region', { name: 'Yarns' });
  expect(within(yarns).getByRole('heading', { name: 'Hobbii' })).toBeInTheDocument();
  expect(yarns).toHaveTextContent('Honey Bunny · Super bulky · Polyester');
  expect(screen.getByRole('region', { name: 'Shops' })).toHaveTextContent('Hobbii');
  expect(screen.getByRole('region', { name: 'Fibers' })).toHaveTextContent('Coton');
});

test('pasting yarn lines imports the understood ones and reports the rest', async () => {
  importLists.mockImplementation((_v, opts) => opts.onSuccess({ added: 1, skipped: 0 }));
  renderWithProviders(<ManageListsPage />);
  await userEvent.type(screen.getByLabelText('Paste yarns'), 'Drops ; Paris ; DK ; Coton{enter}nonsense');
  await userEvent.click(screen.getByRole('button', { name: 'Import yarns' }));
  expect(importLists).toHaveBeenCalledWith(
    { yarns: [{ brand: 'Drops', name: 'Paris', yarn_weight: 'dk', fiber: 'Coton' }] }, expect.anything());
  expect(screen.getByRole('status')).toHaveTextContent('1 added, 0 already there, 1 line not understood (line 2)');
});

test('renames and removes an entry', async () => {
  renderWithProviders(<ManageListsPage />);
  await userEvent.click(screen.getByRole('button', { name: 'Rename Coton' }));
  const field = screen.getByLabelText('New name for Coton');
  await userEvent.clear(field);
  await userEvent.type(field, 'Coton bio');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(rename).toHaveBeenCalledWith({ table: 'fibers', id: 'f1', patch: { name: 'Coton bio' } }, expect.anything());

  await userEvent.click(screen.getByRole('button', { name: 'Remove Toucan' }));
  await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
  expect(remove).toHaveBeenCalledWith({ table: 'catalog_yarns', id: 'c2' });
});
```

- [ ] **Step 7: Run to see it fail**

Run: `npx vitest run src/features/lists/ManageListsPage.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 8: Implement the page**

Create `src/features/lists/ManageListsPage.tsx`:

```tsx
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
```

Note for the test: `screen.getByRole('region', { name: 'Yarns' })` works because each `<section>` has `aria-labelledby` pointing at its `<h2>`.

- [ ] **Step 9: Route and link**

In `src/App.tsx` add the import `import ManageListsPage from './features/lists/ManageListsPage';` and, **before** the `stash/:id` route, add:

```tsx
        <Route path="stash/lists" element={<ManageListsPage />} />
```

In `src/features/stash/StashList.tsx`, replace the header's `+ Yarn` link with:

```tsx
        <span className="flex items-center gap-2">
          <Link to="/stash/lists" className="flex h-11 items-center px-2 text-stash">Manage lists</Link>
          <Link to="/stash/new" className="flex h-11 items-center rounded-full bg-stash px-5 text-white">+ Yarn</Link>
        </span>
```

- [ ] **Step 10: Run the tests and the build**

Run: `npx vitest run src/features/lists src/features/stash` then `npm run build`
Expected: PASS; build succeeds.

- [ ] **Step 11: Commit**

```bash
git add src/features/lists src/App.tsx src/features/stash/StashList.tsx
git commit -m "feat: Manage lists page with paste import for yarns, shops and fibers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Yarn form — suggestions, colour family, fiber dropdown

**Files:**
- Modify: `src/features/stash/YarnForm.tsx` (full replacement below)
- Modify: `src/features/stash/api.ts` (`toYarnInput` adds `color_family`)
- Modify: `src/features/stash/YarnForm.test.tsx`

**Interfaces:**
- Consumes: `useCatalog`, `useShops`, `useFibers` (Task 3); `SuggestField`, `ColourDots`, `ColourFamily` (Task 2); `yarns.color_family` (Task 1).
- Produces: the yarn form saves `color_family`; lists fill up through the database trigger (Task 1), so the form calls no list mutation.

- [ ] **Step 1: Write the failing tests**

Replace `src/features/stash/YarnForm.test.tsx` with:

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import YarnForm from './YarnForm';

const save = vi.fn();
vi.mock('./api', () => ({
  useYarn: () => ({ data: undefined }),
  useSaveYarn: () => ({ mutate: save, isPending: false, error: null }),
  toYarnInput: (y: unknown) => y,
}));
const entry = { user_id: 'u', created_at: '', updated_at: '' };
vi.mock('../lists/api', () => ({
  useCatalog: () => ({ data: [
    { ...entry, id: 'c1', brand: 'Hobbii', name: 'Honey Bunny', yarn_weight: 'super_bulky', fiber: 'Polyester' },
    { ...entry, id: 'c2', brand: 'Hobbii', name: 'Toucan', yarn_weight: 'super_bulky', fiber: 'Polyester' },
    { ...entry, id: 'c3', brand: 'Drops', name: 'Paris', yarn_weight: 'dk', fiber: 'Coton' },
  ] }),
  useShops: () => ({ data: [{ ...entry, id: 's1', name: 'Hobbii' }] }),
  useFibers: () => ({ data: [{ ...entry, id: 'f1', name: 'Polyester' }, { ...entry, id: 'f2', name: 'Coton' }] }),
}));
vi.mock('../../lib/images', () => ({ resizeImage: () => Promise.resolve(new Blob(['x'])) }));
vi.mock('../../lib/storage', () => ({ uploadFile: () => Promise.reject(new Error('Upload failed')), useSignedUrl: () => undefined }));

beforeAll(() => { URL.createObjectURL = vi.fn(() => 'blob:preview'); URL.revokeObjectURL = vi.fn(); });
beforeEach(() => save.mockReset());

const renderNew = () => renderWithProviders(<YarnForm />, { route: '/stash/new', path: '/stash/new' });

test('shows an error and does not save when the photo upload fails', async () => {
  renderNew();
  await userEvent.type(screen.getByLabelText('Name'), 'Fern green');
  await userEvent.upload(screen.getByLabelText('Take or choose a photo'), new File(['x'], 'p.jpg', { type: 'image/jpeg' }));
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Upload failed');
  expect(save).not.toHaveBeenCalled();
});

test("brand narrows the name suggestions; picking a name fills weight and fiber", async () => {
  renderNew();
  await userEvent.type(screen.getByLabelText('Brand'), 'Hob');
  await userEvent.click(screen.getByRole('option', { name: 'Hobbii' }));
  await userEvent.click(screen.getByLabelText('Name'));
  const names = screen.getByRole('listbox', { name: 'Name suggestions' });
  expect(names).toHaveTextContent('Honey Bunny');
  expect(names).not.toHaveTextContent('Paris');
  await userEvent.click(screen.getByRole('option', { name: 'Honey Bunny' }));
  expect(screen.getByLabelText('Weight')).toHaveValue('super_bulky');
  expect(screen.getByLabelText('Fiber')).toHaveValue('Polyester');
});

test('picking a name does not overwrite a weight already chosen', async () => {
  renderNew();
  await userEvent.selectOptions(screen.getByLabelText('Weight'), 'dk');
  await userEvent.click(screen.getByLabelText('Name'));
  await userEvent.click(screen.getByRole('option', { name: 'Toucan' }));
  expect(screen.getByLabelText('Weight')).toHaveValue('dk');
  expect(screen.getByLabelText('Fiber')).toHaveValue('Polyester');
});

test('fiber "Other…" saves a new fiber; colour family and shop are saved', async () => {
  renderNew();
  await userEvent.type(screen.getByLabelText('Name'), 'Rose');
  await userEvent.selectOptions(screen.getByLabelText('Fiber'), 'Other…');
  await userEvent.type(screen.getByLabelText('New fiber'), 'Coton bio');
  await userEvent.click(screen.getByRole('radio', { name: 'Pink' }));
  await userEvent.type(screen.getByLabelText('Shop'), 'Hob');
  await userEvent.click(screen.getByRole('option', { name: 'Hobbii' }));
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(save).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'Rose', fiber: 'Coton bio', color_family: 'pink', bought_at: 'Hobbii' }),
    expect.anything(),
  );
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/features/stash/YarnForm.test.tsx`
Expected: the three new tests FAIL (no suggestions, Fiber is a text field, no colour dots).

- [ ] **Step 3: Check `toYarnInput` carries `color_family`**

Task 1 already added it; if not, in `src/features/stash/api.ts`, in `toYarnInput`, change the first line of the returned object to:

```ts
    id: y.id, brand: y.brand, name: y.name, color: y.color, color_family: y.color_family, yarn_weight: y.yarn_weight, fiber: y.fiber,
```

- [ ] **Step 4: Replace the yarn form**

Replace `src/features/stash/YarnForm.tsx` with:

```tsx
import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import ColourDots from '../../components/ColourDots';
import ErrorBox from '../../components/ErrorBox';
import NumberField from '../../components/NumberField';
import PhotoField from '../../components/PhotoField';
import SuggestField from '../../components/SuggestField';
import { resizeImage } from '../../lib/images';
import { WEIGHTS, type YarnWeight } from '../../lib/labels';
import { uploadFile } from '../../lib/storage';
import { useCatalog, useFibers, useShops } from '../lists/api';
import { toYarnInput, useSaveYarn, useYarn, type YarnInput } from './api';

const empty: YarnInput = {
  brand: null, name: '', color: null, color_family: null, yarn_weight: null, fiber: null, skeins_owned: 1, photo_path: null,
  bought_at: null, price_per_skein: null, bought_on: null, notes: null,
};

const input = 'h-12 rounded-xl border border-line bg-surface px-3';
const label = 'flex flex-col gap-1.5 text-sm text-muted';
const text = (v: string) => (v.trim() === '' ? null : v);
const OTHER = '__other__';
const same = (a: string | null, b: string | null) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

export default function YarnForm() {
  const { id } = useParams();
  const existing = useYarn(id);
  if (id && existing.error) return <ErrorBox error={existing.error} onRetry={() => existing.refetch()} />;
  if (id && !existing.data) return <p className="p-4 text-muted">Loading…</p>;
  return <YarnFormBody initial={existing.data ? toYarnInput(existing.data) : empty} />;
}

function YarnFormBody({ initial }: { initial: YarnInput }) {
  const navigate = useNavigate();
  const save = useSaveYarn();
  const catalog = useCatalog().data ?? [];
  const shops = useShops().data ?? [];
  const fiberList = useFibers().data ?? [];
  const [y, setY] = useState<YarnInput>(initial);
  const [otherFiber, setOtherFiber] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<unknown>(null);
  const set = <K extends keyof YarnInput>(k: K, v: YarnInput[K]) => setY((cur) => ({ ...cur, [k]: v }));

  const brands = [...new Set(catalog.map((c) => c.brand))];
  const names = catalog.filter((c) => !y.brand?.trim() || same(c.brand, y.brand)).map((c) => c.name);
  // The yarn's own fiber is always offered, even if it was removed from the list.
  const fibers = [...new Set([...fiberList.map((f) => f.name), ...(y.fiber && !otherFiber ? [y.fiber] : [])])]
    .sort((a, b) => a.localeCompare(b));

  function pickName(name: string) {
    const found = catalog.find((c) => same(c.name, name) && (!y.brand?.trim() || same(c.brand, y.brand)));
    if (!found) return;
    setY((cur) => ({
      ...cur,
      brand: cur.brand ?? found.brand,
      yarn_weight: cur.yarn_weight ?? found.yarn_weight,
      fiber: cur.fiber ?? found.fiber,
    }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setUploadError(null);
    let photo_path = y.photo_path;
    if (photo) {
      try {
        photo_path = await uploadFile('yarn-photos', await resizeImage(photo), 'jpg');
      } catch (err) {
        setUploadError(err);
        return;
      }
    }
    save.mutate({ ...y, fiber: y.fiber?.trim() || null, photo_path }, { onSuccess: (newId) => navigate(`/stash/${newId}`) });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 p-4">
      <header className="flex items-center justify-between">
        <button type="button" onClick={() => navigate(-1)} className="min-h-11 text-stash">Cancel</button>
        <h1 className="text-2xl text-stash">{initial.id ? 'Edit yarn' : 'New yarn'}</h1>
        <button type="submit" disabled={save.isPending} className="min-h-11 text-stash">Save</button>
      </header>
      {uploadError != null && <ErrorBox error={uploadError} />}
      {save.error && <ErrorBox error={save.error} />}
      <SuggestField label="Brand" value={y.brand ?? ''} onChange={(v) => set('brand', text(v))} suggestions={brands} />
      <SuggestField label="Name" required value={y.name} onChange={(v) => set('name', v)} suggestions={names} onPick={pickName} />
      <label className={label}>Color<input className={input} value={y.color ?? ''} onChange={(e) => set('color', text(e.target.value))} /></label>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">Colour family</span>
        <ColourDots label="Colour family" value={y.color_family} onChange={(v) => set('color_family', v)} />
      </div>
      <div className="flex gap-2">
        <label className={`${label} flex-1`}>Weight
          <select className={input} value={y.yarn_weight ?? ''} onChange={(e) => set('yarn_weight', (e.target.value || null) as YarnWeight | null)}>
            <option value="">—</option>
            {WEIGHTS.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
        </label>
        <label className={`${label} flex-1`}>Fiber
          <select className={input} value={otherFiber ? OTHER : y.fiber ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              setOtherFiber(v === OTHER);
              set('fiber', v === OTHER || v === '' ? null : v);
            }}>
            <option value="">—</option>
            {fibers.map((f) => <option key={f} value={f}>{f}</option>)}
            <option value={OTHER}>Other…</option>
          </select>
        </label>
      </div>
      {otherFiber && (
        <label className={label}>New fiber
          <input autoFocus className={input} value={y.fiber ?? ''} onChange={(e) => set('fiber', e.target.value)} />
        </label>
      )}
      <label className={label}>Skeins owned
        <NumberField required value={y.skeins_owned} min={0} step={0.25} emptyValue={0}
          onChange={(v) => set('skeins_owned', v ?? 0)} className={input} />
      </label>
      <PhotoField label="Photo" bucket="yarn-photos" path={y.photo_path} file={photo}
        onFile={setPhoto} onRemove={() => set('photo_path', null)} />
      <SuggestField label="Shop" value={y.bought_at ?? ''} onChange={(v) => set('bought_at', text(v))} suggestions={shops.map((s) => s.name)} />
      <div className="flex gap-2">
        <label className={`${label} flex-1`}>Price per skein (€)
          <NumberField value={y.price_per_skein} min={0} step={0.01}
            onChange={(v) => set('price_per_skein', v)} className={input} />
        </label>
        <label className={`${label} flex-1`}>Bought on
          <input type="date" className={input} value={y.bought_on ?? ''} onChange={(e) => set('bought_on', e.target.value || null)} />
        </label>
      </div>
      <label className={label}>Notes<textarea rows={3} className="rounded-xl border border-line bg-surface p-3" value={y.notes ?? ''} onChange={(e) => set('notes', text(e.target.value))} /></label>
    </form>
  );
}
```

Notes for the implementer:
- `set` uses the functional `setY` form because `SuggestField` calls `onChange` then `onPick` in the same tap; the second update must see the first.
- `SuggestField`'s visible label text is "Brand", "Name", "Shop", so `getByLabelText('Name')` and the end-to-end test's `getByLabel('Name', { exact: true })` still find the field.

- [ ] **Step 5: Run the tests and the build**

Run: `npx vitest run src/features/stash` then `npm run build`
Expected: PASS; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/features/stash/YarnForm.tsx src/features/stash/YarnForm.test.tsx src/features/stash/api.ts
git commit -m "feat: yarn form suggests brands, names and shops; fiber dropdown; colour family

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Stash — search and colour filter

**Files:**
- Modify: `src/features/stash/logic.ts`, `src/features/stash/logic.test.ts`
- Modify: `src/features/stash/StashList.tsx`, `src/features/stash/StashList.test.tsx`

**Interfaces:**
- Consumes: `ColourDots`, `colourHex`, `colourLabel`, `ColourFamily` (Task 2); `yarns.color_family` (Task 1).
- Produces: `filterYarns(yarns, { weight, fiber, lowOnly, search, family })` where `search: string` and `family: ColourFamily | 'all'`. Task 7 reuses it in the yarn picker.

- [ ] **Step 1: Write the failing tests**

In `src/features/stash/logic.test.ts`:
1. Add `color_family: null,` to the `yarn()` fixture defaults (after `color: null,`).
2. Replace the `filterYarns` test with:

```ts
const yarns = [
  yarn({ id: 'a', name: 'Honey Bunny', brand: 'Hobbii', color: 'Teal', color_family: 'blue', yarn_weight: 'dk', fiber: 'Cotton', free: 3 }),
  yarn({ id: 'b', name: 'Toucan', brand: 'Hobbii', color: 'Sage', color_family: 'green', yarn_weight: 'worsted', fiber: 'Merino', free: 0.6 }),
  yarn({ id: 'c', name: 'Paris', brand: 'Drops', color: 'Mint green', yarn_weight: 'dk', fiber: 'Merino', free: 0 }),
];
const none = { weight: 'all', fiber: 'all', lowOnly: false, search: '', family: 'all' } as const;

test('filterYarns by weight, fiber and low stock', () => {
  const ids = (f: Partial<Parameters<typeof filterYarns>[1]>) => filterYarns(yarns, { ...none, ...f }).map((y) => y.id);
  expect(ids({})).toEqual(['a', 'b', 'c']);
  expect(ids({ weight: 'dk' })).toEqual(['a', 'c']);
  expect(ids({ fiber: 'Merino' })).toEqual(['b', 'c']);
  expect(ids({ lowOnly: true })).toEqual(['b', 'c']);
});

test('filterYarns searches name, brand and colour, ignoring case, and filters by colour family', () => {
  const ids = (f: Partial<Parameters<typeof filterYarns>[1]>) => filterYarns(yarns, { ...none, ...f }).map((y) => y.id);
  expect(ids({ search: 'bunny' })).toEqual(['a']);
  expect(ids({ search: 'HOBBII' })).toEqual(['a', 'b']);
  expect(ids({ search: ' green ' })).toEqual(['c']);
  expect(ids({ family: 'green' })).toEqual(['b']);
  expect(ids({ family: 'green', search: 'paris' })).toEqual([]);
});
```

(Remove the old `const yarns = [...]` block above the old test; the new one replaces it. If `mergeYarnUsage` tests below use `yarns`, they don't — they build their own data.)

In `src/features/stash/StashList.test.tsx`:
1. Add `color_family: null,` to `base`.
2. Give the yarns colour families: `Fern green` → `color_family: 'green'`, `Rust` → `color_family: 'orange'` (add to their objects), `Charcoal` keeps `null`.
3. Add:

```tsx
test('search box and colour dots narrow the list', async () => {
  renderWithProviders(<StashList />);
  expect(screen.getAllByRole('radio').map((r) => r.getAttribute('aria-label'))).toEqual(['Orange', 'Green']);
  await userEvent.click(screen.getByRole('radio', { name: 'Green' }));
  expect(screen.queryByRole('link', { name: /Rust/ })).toBeNull();
  expect(screen.getByRole('link', { name: /Fern green/ })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('radio', { name: 'Green' }));
  await userEvent.type(screen.getByLabelText('Search yarns'), 'char');
  expect(screen.getAllByRole('link', { name: /sk free/ })).toHaveLength(1);
  expect(screen.getByRole('link', { name: /Charcoal/ })).toBeInTheDocument();
});
```

(The order is the order of `COLOUR_FAMILIES` — orange before green — restricted to families in use.)

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run src/features/stash/logic.test.ts src/features/stash/StashList.test.tsx`
Expected: FAIL (search/family ignored, no search box, no dots).

- [ ] **Step 3: Implement the filter**

In `src/features/stash/logic.ts`, add `import type { ColourFamily } from '../../lib/colours';` and replace `filterYarns` with:

```ts
export function filterYarns(
  yarns: YarnWithStock[],
  f: { weight: YarnWeight | 'all'; fiber: string | 'all'; lowOnly: boolean; search: string; family: ColourFamily | 'all' },
): YarnWithStock[] {
  const q = f.search.trim().toLowerCase();
  return yarns.filter(
    (y) =>
      (f.weight === 'all' || y.yarn_weight === f.weight) &&
      (f.fiber === 'all' || y.fiber === f.fiber) &&
      (!f.lowOnly || stockBadge(y.free) !== null) &&
      (f.family === 'all' || y.color_family === f.family) &&
      (q === '' || [y.name, y.brand, y.color].some((s) => s?.toLowerCase().includes(q))),
  );
}
```

- [ ] **Step 4: Search box, colour dots and the card dot in the Stash**

In `src/features/stash/StashList.tsx`:
1. Add imports:

```tsx
import ColourDots from '../../components/ColourDots';
import { COLOUR_FAMILIES, colourHex, colourLabel, type ColourFamily } from '../../lib/colours';
```

2. Add state next to the others:

```tsx
  const [search, setSearch] = useState('');
  const [family, setFamily] = useState<ColourFamily | 'all'>('all');
```

3. After `const fibers = …`, add and change:

```tsx
  const families = COLOUR_FAMILIES.map((c) => c.value).filter((f) => data.some((y) => y.color_family === f));
  const shown = filterYarns(data, { weight, fiber, lowOnly, search, family });
```

(replacing the old `const shown = …` line).

4. Directly after the `</header>`, insert:

```tsx
      <input type="search" aria-label="Search yarns" placeholder="Search name, brand or colour" value={search}
        onChange={(e) => setSearch(e.target.value)} className="h-12 rounded-full border border-line bg-surface px-4" />
      {families.length > 0 && (
        <ColourDots label="Colour" value={family === 'all' ? null : family} families={families}
          onChange={(v) => setFamily(v ?? 'all')} />
      )}
```

5. In `YarnCard`, replace the name line with:

```tsx
        <span className="flex items-center gap-1.5 text-base text-stash">
          {yarn.color_family && (
            <span title={colourLabel(yarn.color_family)} className="h-3 w-3 shrink-0 rounded-full border border-line"
              style={{ background: colourHex(yarn.color_family) }} />
          )}
          {yarn.name}
        </span>
```

- [ ] **Step 5: Run the tests and the build**

Run: `npx vitest run src/features/stash` then `npm run build`
Expected: PASS; build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/features/stash
git commit -m "feat: search the stash by name, brand or colour and filter by colour family

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Pattern materials — form section, saving, pattern page

**Files:**
- Create: `src/features/materials/logic.ts`, `src/features/materials/logic.test.ts`
- Create: `src/features/materials/MaterialsSection.tsx`, `src/features/materials/MaterialsSection.test.tsx`
- Create: `src/features/materials/MaterialsList.tsx`, `src/features/materials/MaterialsList.test.tsx`
- Modify: `src/features/patterns/api.ts` (fetch + save materials, `useMaterialNames`)
- Modify: `src/features/patterns/PatternForm.tsx`, `src/features/patterns/PatternForm.test.tsx`
- Modify: `src/features/patterns/PatternPage.tsx`

**Interfaces:**
- Consumes: tables `pattern_yarns`, `pattern_materials` (Task 1); `ColourDots`, `SuggestField`, `colourHex`, `ColourFamily` (Task 2); `useCatalog` (Task 3); `NumberField`.
- Produces:
  - `type YarnLineDraft = { id?: string; color: string; color_family: ColourFamily | null; skeins: number | null; yarn_type: string }`
  - `type MaterialDraft = { id?: string; name: string; quantity: number | null }`
  - `cleanYarnLines(d: YarnLineDraft[])`, `cleanMaterials(d: MaterialDraft[])`, `planRows(existingIds, rows)`, `skeinsText(n: number): string`
  - `type PatternYarn = Tables<'pattern_yarns'>`, `type PatternMaterial = Tables<'pattern_materials'>`; `PatternListItem` gains `yarn_lines: PatternYarn[]` and `materials: PatternMaterial[]` (sorted by position). Task 7 reads `yarn_lines`.
  - `useSavePattern` input becomes `{ pattern, parts, yarnLines: YarnLineDraft[], materials: MaterialDraft[] }`.
  - `useMaterialNames()` — query `['patterns', 'material-names']` → sorted unique names.

- [ ] **Step 1: Write the failing logic tests**

Create `src/features/materials/logic.test.ts`:

```ts
import { cleanMaterials, cleanYarnLines, planRows, skeinsText } from './logic';

test('cleanYarnLines trims, drops lines without a colour and numbers positions', () => {
  expect(cleanYarnLines([
    { id: 'y1', color: ' Pink ', color_family: 'pink', skeins: 2, yarn_type: ' Hobbii Honey Bunny ' },
    { color: '   ', color_family: null, skeins: 1, yarn_type: '' },
    { color: 'White', color_family: null, skeins: null, yarn_type: '  ' },
  ])).toEqual([
    { id: 'y1', color: 'Pink', color_family: 'pink', skeins: 2, yarn_type: 'Hobbii Honey Bunny', position: 0 },
    { color: 'White', color_family: null, skeins: null, yarn_type: null, position: 1 },
  ]);
});

test('cleanMaterials trims, drops blank names and empties a zero quantity', () => {
  expect(cleanMaterials([
    { name: ' Safety eyes 10 mm ', quantity: 2 },
    { name: '', quantity: 4 },
    { id: 'm1', name: 'Stuffing', quantity: 0 },
  ])).toEqual([
    { name: 'Safety eyes 10 mm', quantity: 2, position: 0 },
    { id: 'm1', name: 'Stuffing', quantity: null, position: 1 },
  ]);
});

test('planRows keeps known ids, inserts the rest and deletes the missing', () => {
  const plan = planRows(['a', 'b'], [{ id: 'a', name: 'x' }, { name: 'y' }, { id: 'zz', name: 'z' }]);
  expect(plan).toEqual({
    updates: [{ id: 'a', name: 'x' }],
    inserts: [{ name: 'y' }, { name: 'z' }],
    deleteIds: ['b'],
  });
});

test('skeinsText', () => {
  expect(skeinsText(1)).toBe('1 skein');
  expect(skeinsText(2)).toBe('2 skeins');
  expect(skeinsText(0.5)).toBe('0.5 skein');
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run src/features/materials/logic.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the logic**

Create `src/features/materials/logic.ts`:

```ts
import type { ColourFamily } from '../../lib/colours';

export type YarnLineDraft = { id?: string; color: string; color_family: ColourFamily | null; skeins: number | null; yarn_type: string };
export type MaterialDraft = { id?: string; name: string; quantity: number | null };

export function cleanYarnLines(drafts: YarnLineDraft[]) {
  return drafts
    .map((d) => ({ ...d, color: d.color.trim(), yarn_type: d.yarn_type.trim() === '' ? null : d.yarn_type.trim() }))
    .filter((d) => d.color !== '')
    .map((d, position) => ({ ...d, position }));
}

export function cleanMaterials(drafts: MaterialDraft[]) {
  return drafts
    .map((d) => ({ ...d, name: d.name.trim(), quantity: d.quantity !== null && d.quantity > 0 ? d.quantity : null }))
    .filter((d) => d.name !== '')
    .map((d, position) => ({ ...d, position }));
}

/** What saving must do so that kept rows keep their id. */
export function planRows<T extends { id?: string }>(existingIds: string[], rows: T[]) {
  const existing = new Set(existingIds);
  const updates: (Omit<T, 'id'> & { id: string })[] = [];
  const inserts: Omit<T, 'id'>[] = [];
  for (const { id, ...row } of rows) {
    if (id && existing.has(id)) updates.push({ id, ...row });
    else inserts.push(row);
  }
  const kept = new Set(updates.map((u) => u.id));
  return { updates, inserts, deleteIds: existingIds.filter((id) => !kept.has(id)) };
}

/** "1 skein", "2 skeins"; fractions read as "0.5 skein". */
export function skeinsText(n: number): string {
  return `${Number(n.toFixed(2))} ${n > 1 ? 'skeins' : 'skein'}`;
}
```

- [ ] **Step 4: Run the logic tests**

Run: `npx vitest run src/features/materials/logic.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing component tests**

Create `src/features/materials/MaterialsSection.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { MaterialDraft, YarnLineDraft } from './logic';
import MaterialsSection from './MaterialsSection';

let latest: { yarnLines: YarnLineDraft[]; materials: MaterialDraft[] };
function Harness() {
  const [yarnLines, setYarnLines] = useState<YarnLineDraft[]>([]);
  const [materials, setMaterials] = useState<MaterialDraft[]>([]);
  latest = { yarnLines, materials };
  return (
    <MaterialsSection yarnLines={yarnLines} onYarnLines={setYarnLines} materials={materials} onMaterials={setMaterials}
      yarnTypes={['Hobbii Honey Bunny']} materialNames={['Safety eyes 10 mm']} />
  );
}

test('adds a yarn line with colour, family, skeins and type, and a material', async () => {
  render(<Harness />);
  await userEvent.click(screen.getByRole('button', { name: '+ Yarn' }));
  await userEvent.type(screen.getByLabelText('Colour'), 'Pink');
  await userEvent.click(screen.getByRole('radio', { name: 'Pink' }));
  await userEvent.type(screen.getByLabelText('Skeins'), '2');
  await userEvent.tab();
  await userEvent.type(screen.getByLabelText('Yarn type'), 'bunny');
  await userEvent.click(screen.getByRole('option', { name: 'Hobbii Honey Bunny' }));

  await userEvent.click(screen.getByRole('button', { name: '+ Material' }));
  await userEvent.type(screen.getByLabelText('Material'), 'eyes');
  await userEvent.click(screen.getByRole('option', { name: 'Safety eyes 10 mm' }));
  await userEvent.type(screen.getByLabelText('Quantity'), '2');
  await userEvent.tab();

  expect(latest.yarnLines).toEqual([{ color: 'Pink', color_family: 'pink', skeins: 2, yarn_type: 'Hobbii Honey Bunny' }]);
  expect(latest.materials).toEqual([{ name: 'Safety eyes 10 mm', quantity: 2 }]);

  await userEvent.click(screen.getByRole('button', { name: 'Remove yarn line' }));
  await userEvent.click(screen.getByRole('button', { name: 'Remove material' }));
  expect(latest).toEqual({ yarnLines: [], materials: [] });
});
```

Create `src/features/materials/MaterialsList.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import MaterialsList from './MaterialsList';

const row = { user_id: 'u', pattern_id: 'p', created_at: '', updated_at: '' };

test('lists yarn lines and other materials', () => {
  render(<MaterialsList
    yarnLines={[{ ...row, id: 'y1', position: 0, color: 'Pink', color_family: 'pink', skeins: 2, yarn_type: 'Hobbii Honey Bunny' },
      { ...row, id: 'y2', position: 1, color: 'White', color_family: null, skeins: null, yarn_type: null }]}
    materials={[{ ...row, id: 'm1', position: 0, name: 'Safety eyes 10 mm', quantity: 2 },
      { ...row, id: 'm2', position: 1, name: 'Stuffing', quantity: null }]} />);
  const items = screen.getAllByRole('listitem').map((li) => li.textContent);
  expect(items).toEqual(['Pink · 2 skeins · Hobbii Honey Bunny', 'White', 'Safety eyes 10 mm × 2', 'Stuffing']);
  expect(screen.getByRole('heading', { name: 'Materials' })).toBeInTheDocument();
});

test('renders nothing without materials', () => {
  const { container } = render(<MaterialsList yarnLines={[]} materials={[]} />);
  expect(container).toBeEmptyDOMElement();
});
```

- [ ] **Step 6: Run to see them fail**

Run: `npx vitest run src/features/materials`
Expected: the two component test files FAIL (modules not found).

- [ ] **Step 7: Implement the components**

Create `src/features/materials/MaterialsSection.tsx`:

```tsx
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
            <SuggestField label="Material" value={m.name} suggestions={materialNames}
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
```

Create `src/features/materials/MaterialsList.tsx`:

```tsx
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
```

- [ ] **Step 8: Run the component tests**

Run: `npx vitest run src/features/materials`
Expected: PASS.

- [ ] **Step 9: Fetch and save materials in the patterns API**

In `src/features/patterns/api.ts`:

1. Add imports:

```ts
import { cleanMaterials, cleanYarnLines, planRows, type MaterialDraft, type YarnLineDraft } from '../materials/logic';
```

2. Add types and extend `PatternListItem`:

```ts
export type PatternYarn = Tables<'pattern_yarns'>;
export type PatternMaterial = Tables<'pattern_materials'>;
```

and inside `PatternListItem` add `yarn_lines: PatternYarn[];` and `materials: PatternMaterial[];` after `parts: PatternPart[];`.

3. In `fetchPatterns`, change the select to:

```ts
  let pq = supabase.from('patterns')
    .select('*, type:pattern_types(*), parts:pattern_parts(*), yarn_lines:pattern_yarns(*), materials:pattern_materials(*)')
    .order('name');
```

and in the returned object, after the `parts:` line, add:

```ts
      yarn_lines: [...pattern.yarn_lines].sort((a, b) => a.position - b.position),
      materials: [...pattern.materials].sort((a, b) => a.position - b.position),
```

4. Add, above `useSavePattern`:

```ts
type RowTable = 'pattern_yarns' | 'pattern_materials';

/** Update kept rows, insert new ones, delete removed ones (same approach as pattern parts). */
async function syncRows(table: RowTable, patternId: string, rows: { id?: string }[]) {
  // Both tables change the same way; the cast keeps supabase-js's per-table row types out of the way.
  const t = () => supabase.from(table as 'pattern_yarns');
  const old = await t().select('id').eq('pattern_id', patternId);
  if (old.error) throw old.error;
  const plan = planRows(old.data.map((r) => r.id), rows);
  for (const { id, ...fields } of plan.updates) {
    const up = await t().update(fields as never).eq('id', id);
    if (up.error) throw up.error;
  }
  if (plan.inserts.length > 0) {
    const ins = await t().insert(plan.inserts.map((r) => ({ ...r, pattern_id: patternId })) as never);
    if (ins.error) throw ins.error;
  }
  if (plan.deleteIds.length > 0) {
    const del = await t().delete().in('id', plan.deleteIds);
    if (del.error) throw del.error;
  }
}
```

5. Change `useSavePattern`'s `mutationFn` signature to:

```ts
    mutationFn: async ({ pattern, parts, yarnLines, materials }: {
      pattern: PatternInput; parts: PartDraft[]; yarnLines: YarnLineDraft[]; materials: MaterialDraft[];
    }): Promise<string> => {
```

and just before `return patternId;` add:

```ts
      await syncRows('pattern_yarns', patternId, cleanYarnLines(yarnLines));
      await syncRows('pattern_materials', patternId, cleanMaterials(materials));
```

6. Add:

```ts
/** Names of other materials already used on any pattern, for suggestions. */
export function useMaterialNames() {
  return useQuery({
    queryKey: ['patterns', 'material-names'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pattern_materials').select('name');
      if (error) throw error;
      return [...new Set(data.map((m) => m.name))].sort((a, b) => a.localeCompare(b));
    },
  });
}
```

- [ ] **Step 10: Wire the form**

In `src/features/patterns/PatternForm.tsx`:

1. Imports: add `useMaterialNames` to the `./api` import, and:

```tsx
import { useCatalog } from '../lists/api';
import type { MaterialDraft, YarnLineDraft } from '../materials/logic';
import MaterialsSection from '../materials/MaterialsSection';
```

2. In `PatternForm`, after the `parts` constant:

```tsx
  const yarnLines: YarnLineDraft[] = (existing.data?.yarn_lines ?? []).map((y) => ({
    id: y.id, color: y.color, color_family: y.color_family, skeins: y.skeins === null ? null : Number(y.skeins), yarn_type: y.yarn_type ?? '',
  }));
  const materials: MaterialDraft[] = (existing.data?.materials ?? []).map((m) => ({
    id: m.id, name: m.name, quantity: m.quantity === null ? null : Number(m.quantity),
  }));
```

and pass them: `<PatternFormBody initial={…} initialParts={…} initialYarnLines={yarnLines} initialMaterials={materials} />`.

3. `PatternFormBody` props become `{ initial, initialParts, initialYarnLines, initialMaterials }: { initial: PatternInput; initialParts: PartDraft[]; initialYarnLines: YarnLineDraft[]; initialMaterials: MaterialDraft[] }`, with state:

```tsx
  const [yarnLines, setYarnLines] = useState(initialYarnLines);
  const [materials, setMaterials] = useState(initialMaterials);
  const catalog = useCatalog();
  const materialNames = useMaterialNames();
```

4. In `submit`, change the save call to:

```tsx
    save.mutate({ pattern: { ...p, pdf_path, photo_path }, parts, yarnLines, materials }, { onSuccess: (newId) => navigate(`/patterns/${newId}`) });
```

5. Between the `+ Add part` button and the Notes label, add:

```tsx
      <MaterialsSection yarnLines={yarnLines} onYarnLines={setYarnLines} materials={materials} onMaterials={setMaterials}
        yarnTypes={(catalog.data ?? []).map((c) => `${c.brand} ${c.name}`)} materialNames={materialNames.data ?? []} />
```

6. Update `src/features/patterns/PatternForm.test.tsx`:
   - add `useMaterialNames: () => ({ data: [] }),` to the `./api` mock;
   - add `vi.mock('../lists/api', () => ({ useCatalog: () => ({ data: [] }) }));`;
   - in the first test's exact expectation, add `yarnLines: [], materials: [],` next to `parts`;
   - add this test:

```tsx
test('saves materials with the pattern', async () => {
  renderWithProviders(<PatternForm />, { route: '/patterns/new', path: '/patterns/new' });
  await userEvent.type(screen.getByLabelText('Name'), 'Bunny');
  await userEvent.click(screen.getByRole('button', { name: '+ Yarn' }));
  await userEvent.type(screen.getByLabelText('Colour'), 'Pink');
  await userEvent.click(screen.getByRole('button', { name: '+ Material' }));
  await userEvent.type(screen.getByLabelText('Material'), 'Safety eyes 10 mm');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));
  expect(save).toHaveBeenCalledWith(expect.objectContaining({
    yarnLines: [{ color: 'Pink', color_family: null, skeins: null, yarn_type: '' }],
    materials: [{ name: 'Safety eyes 10 mm', quantity: null }],
  }), expect.anything());
});
```

- [ ] **Step 11: Show materials on the pattern page**

In `src/features/patterns/PatternPage.tsx` add `import MaterialsList from '../materials/MaterialsList';` and, right after the `</ul>` that closes the parts list, add:

```tsx
      <MaterialsList yarnLines={p.yarn_lines} materials={p.materials} />
```

- [ ] **Step 12: Run everything touched, and the build**

Run: `npx vitest run src/features/materials src/features/patterns` then `npm run build`
Expected: PASS; build succeeds. If another test file builds a `PatternListItem` fixture and the build complains about `yarn_lines`/`materials`, add `yarn_lines: [], materials: []` to it.

- [ ] **Step 13: Commit**

```bash
git add src/features/materials src/features/patterns
git commit -m "feat: materials on patterns — yarn per colour and other materials

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Start a project with stash yarns for the pattern's colours

**Files:**
- Modify: `src/features/patterns/api.ts` (`useStartProject` takes plans)
- Create: `src/features/projects/YarnPicker.tsx`
- Create: `src/features/projects/StartProjectPage.tsx`, `src/features/projects/StartProjectPage.test.tsx`
- Modify: `src/App.tsx` (route `patterns/:id/start`)
- Modify: `src/features/projects/NewProject.tsx`, `src/features/projects/NewProject.test.tsx`
- Modify: `src/features/patterns/PatternPage.tsx`

**Interfaces:**
- Consumes: RPC `start_project_from_pattern(p_pattern_id, p_plans)` (Task 1); `ColourDots`, `colourHex`, `ColourFamily` (Task 2); `filterYarns` with `search` and `family` (Task 5); `PatternListItem.yarn_lines`, `skeinsText` (Task 6); `useYarns`, `YarnWithStock`; `formatSkeins`.
- Produces:
  - `useStartProject()` mutation input `{ patternId: string; plans?: { yarn_id: string; skeins: number }[] }` → project id.
  - `<YarnPicker yarns initialFamily onPick />` — `yarns: YarnWithStock[]`, `initialFamily: ColourFamily | null`, `onPick(y: YarnWithStock)`.
  - Route `/patterns/:id/start` → `StartProjectPage`. Starting from a pattern **with** yarn lines goes there; a pattern without yarn lines starts directly, as today.

- [ ] **Step 1: Change `useStartProject`**

In `src/features/patterns/api.ts` replace `useStartProject` with:

```ts
export function useStartProject() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async ({ patternId, plans = [] }: { patternId: string; plans?: { yarn_id: string; skeins: number }[] }): Promise<string> => {
      const { data, error } = await supabase.rpc('start_project_from_pattern', { p_pattern_id: patternId, p_plans: plans });
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/features/projects/StartProjectPage.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import StartProjectPage from './StartProjectPage';

const start = vi.fn();
const row = { user_id: 'u', pattern_id: 'p1', created_at: '', updated_at: '' };
const pattern = {
  id: 'p1', name: 'Bunny',
  yarn_lines: [
    { ...row, id: 'l1', position: 0, color: 'Pink', color_family: 'pink', skeins: 2, yarn_type: null },
    { ...row, id: 'l2', position: 1, color: 'White', color_family: 'white', skeins: 1, yarn_type: null },
  ],
};
const yarn = (id: string, name: string, color_family: string | null, free: number) => ({
  id, name, brand: 'Hobbii', color: null, color_family, yarn_weight: null, fiber: null, free, owned: free, used: 0, reserved: 0,
});
vi.mock('../patterns/api', () => ({
  usePattern: () => ({ data: pattern, isPending: false, error: null }),
  useStartProject: () => ({ mutate: start, isPending: false, error: null }),
}));
vi.mock('../stash/api', () => ({
  useYarns: () => ({ data: [yarn('y1', 'Honey Bunny', 'pink', 3), yarn('y2', 'Paris', 'green', 1)], error: null }),
}));

const renderPage = () => renderWithProviders(<StartProjectPage />, { route: '/patterns/p1/start', path: '/patterns/:id/start' });

test('the picker starts on the line colour, search looks through every yarn', async () => {
  renderPage();
  expect(screen.getByText('Pink · 2 skeins')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Choose yarn for Pink' }));
  expect(screen.getByRole('button', { name: /Honey Bunny/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Paris/ })).toBeNull();
  await userEvent.type(screen.getByLabelText('Search stash'), 'paris');
  await userEvent.click(screen.getByRole('button', { name: /Paris/ }));
  expect(screen.getByRole('button', { name: 'Change yarn for Pink' })).toBeInTheDocument();
  expect(screen.getByText('→ Paris')).toBeInTheDocument();
});

test('starts the project with the picked yarns; skipped lines are not planned', async () => {
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: 'Choose yarn for Pink' }));
  await userEvent.click(screen.getByRole('button', { name: /Honey Bunny/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Start project' }));
  expect(start).toHaveBeenCalledWith({ patternId: 'p1', plans: [{ yarn_id: 'y1', skeins: 2 }] }, expect.anything());
});

test('a picked yarn can be skipped again', async () => {
  renderPage();
  await userEvent.click(screen.getByRole('button', { name: 'Choose yarn for Pink' }));
  await userEvent.click(screen.getByRole('button', { name: /Honey Bunny/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Skip Pink' }));
  expect(screen.getByRole('button', { name: 'Choose yarn for Pink' })).toBeInTheDocument();
});
```

In `src/features/projects/NewProject.test.tsx`:
1. Add `yarn_lines: []` to the `T-rex` fixture and `yarn_lines: [{ id: 'l1' }]` to the `Bag A` fixture.
2. Above the mocks, add a navigate spy and mock:

```tsx
const navigate = vi.fn();
vi.mock('react-router', async (orig) => ({ ...(await orig<typeof import('react-router')>()), useNavigate: () => navigate }));
```

3. In the second test change the expectation to `expect(startProject).toHaveBeenCalledWith({ patternId: 'p1' }, expect.anything());`.
4. Add:

```tsx
test('a pattern with yarn lines opens the yarn step instead of starting at once', async () => {
  renderWithProviders(<NewProject />);
  await userEvent.click(screen.getByRole('button', { name: /Bag A/ }));
  expect(navigate).toHaveBeenCalledWith('/patterns/p2/start');
  expect(startProject).not.toHaveBeenCalledWith({ patternId: 'p2' }, expect.anything());
});
```

- [ ] **Step 3: Run to see them fail**

Run: `npx vitest run src/features/projects/StartProjectPage.test.tsx src/features/projects/NewProject.test.tsx`
Expected: FAIL (page missing; NewProject still calls `start.mutate(p.id, …)`).

- [ ] **Step 4: Implement the picker and the page**

Create `src/features/projects/YarnPicker.tsx`:

```tsx
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
```

Create `src/features/projects/StartProjectPage.tsx`:

```tsx
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import ErrorBox from '../../components/ErrorBox';
import { colourHex } from '../../lib/colours';
import { skeinsText } from '../materials/logic';
import { usePattern, useStartProject } from '../patterns/api';
import { useYarns } from '../stash/api';
import type { YarnWithStock } from '../stash/logic';
import YarnPicker from './YarnPicker';

export default function StartProjectPage() {
  const { id } = useParams() as { id: string };
  const navigate = useNavigate();
  const pattern = usePattern(id);
  const yarns = useYarns();
  const start = useStartProject();
  const [picks, setPicks] = useState<Record<string, YarnWithStock>>({});
  const [open, setOpen] = useState<string | null>(null);

  if (pattern.error) return <ErrorBox error={pattern.error} />;
  if (!pattern.data) return <p className="p-4 text-muted">Loading…</p>;
  const p = pattern.data;

  function startProject() {
    const plans = p.yarn_lines
      .filter((l) => picks[l.id])
      .map((l) => ({ yarn_id: picks[l.id].id, skeins: Number(l.skeins ?? 0) }));
    start.mutate({ patternId: id, plans }, { onSuccess: (projectId) => navigate(`/projects/${projectId}`) });
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <Link to={`/patterns/${id}`} className="flex min-h-11 items-center self-start text-projects">‹ {p.name}</Link>
      <h1 className="text-4xl text-projects">Start {p.name}</h1>
      <p className="text-muted">Pick a stash yarn for each colour, or skip it. You can change it later.</p>
      {(yarns.error || start.error) && <ErrorBox error={yarns.error ?? start.error} />}
      {p.yarn_lines.map((l) => {
        const picked = picks[l.id];
        return (
          <div key={l.id} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3">
            <div className="flex items-center gap-2">
              {l.color_family && <span aria-hidden className="h-3.5 w-3.5 rounded-full border border-line" style={{ background: colourHex(l.color_family) }} />}
              <span className="flex-1">{[l.color, l.skeins !== null && skeinsText(Number(l.skeins))].filter(Boolean).join(' · ')}</span>
            </div>
            {picked && <span className="text-stash">→ {picked.name}</span>}
            <div className="flex gap-2">
              <button type="button" aria-label={`${picked ? 'Change' : 'Choose'} yarn for ${l.color}`}
                onClick={() => setOpen(open === l.id ? null : l.id)}
                className="h-11 rounded-full border border-line px-4 text-projects">{picked ? 'Change' : 'Choose yarn'}</button>
              {picked && (
                <button type="button" aria-label={`Skip ${l.color}`} className="h-11 px-3 text-muted"
                  onClick={() => setPicks(({ [l.id]: _, ...rest }) => rest)}>Skip</button>
              )}
            </div>
            {open === l.id && (
              <YarnPicker yarns={yarns.data ?? []} initialFamily={l.color_family}
                onPick={(y) => { setPicks((cur) => ({ ...cur, [l.id]: y })); setOpen(null); }} />
            )}
          </div>
        );
      })}
      <button type="button" disabled={start.isPending} onClick={startProject} className="h-14 rounded-full bg-projects text-lg text-white">
        Start project
      </button>
    </div>
  );
}
```

If the linter flags the unused `_` in the Skip handler, replace that handler with:

```tsx
onClick={() => setPicks((cur) => { const next = { ...cur }; delete next[l.id]; return next; })}
```

- [ ] **Step 5: Route and callers**

In `src/App.tsx` import `StartProjectPage from './features/projects/StartProjectPage'` and add, next to the other pattern routes:

```tsx
        <Route path="patterns/:id/start" element={<StartProjectPage />} />
```

In `src/features/projects/NewProject.tsx` change the pattern button's `onClick` to:

```tsx
onClick={() => (p.yarn_lines.length > 0 ? navigate(`/patterns/${p.id}/start`) : start.mutate({ patternId: p.id }, open))}
```

In `src/features/patterns/PatternPage.tsx` change the "Start a project from this pattern" button's `onClick` to:

```tsx
onClick={() => (p.yarn_lines.length > 0
  ? navigate(`/patterns/${id}/start`)
  : start.mutate({ patternId: id }, { onSuccess: (projectId) => navigate(`/projects/${projectId}`) }))}
```

- [ ] **Step 6: Run the tests and the build**

Run: `npx vitest run src/features/projects src/features/patterns` then `npm run build`
Expected: PASS; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/features/projects src/features/patterns
git commit -m "feat: pick stash yarns for a pattern's colours when starting a project

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Compare a project with its pattern

**Files:**
- Create: `src/features/projects/patternDiff.ts`, `src/features/projects/patternDiff.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks (pure functions); the change shapes match `apply_pattern_update` (Task 1).
- Produces:

```ts
export type DiffPart = {
  id: string; name: string; position: number; total_rows: number | null;
  pattern_part_id: string | null; from_pattern: boolean; hasWork: boolean;
};
export type DiffPatternPart = { id: string; name: string; count: number; total_rows: number | null; position: number };
export type PatternChange =
  | { key: string; kind: 'add'; patternPartId: string; name: string; totalRows: number | null; afterPartId: string | null }
  | { key: string; kind: 'rename'; partId: string; from: string; to: string; defaultOn: boolean }
  | { key: string; kind: 'rows'; partId: string; name: string; from: number | null; to: number | null }
  | { key: string; kind: 'removed'; partId: string; name: string };
export function diffProjectWithPattern(parts: DiffPart[], patternParts: DiffPatternPart[]): PatternChange[];
export function defaultTicks(changes: PatternChange[]): Set<string>;
export function toRpcChanges(changes: PatternChange[], ticked: Set<string>): Record<string, unknown>[];
```

- [ ] **Step 1: Write the failing tests**

Create `src/features/projects/patternDiff.test.ts`:

```ts
import { defaultTicks, diffProjectWithPattern, toRpcChanges, type DiffPart, type DiffPatternPart } from './patternDiff';

const part = (id: string, name: string, position: number, pp: string | null, over: Partial<DiffPart> = {}): DiffPart =>
  ({ id, name, position, total_rows: null, pattern_part_id: pp, from_pattern: pp !== null, hasWork: false, ...over });
const pp = (id: string, name: string, count: number, position: number, total_rows: number | null = null): DiffPatternPart =>
  ({ id, name, count, position, total_rows });

test('no differences', () => {
  expect(diffProjectWithPattern(
    [part('a', 'Head', 0, 'H'), part('b', 'Leg 1', 1, 'L'), part('c', 'Leg 2', 2, 'L')],
    [pp('H', 'Head', 1, 0), pp('L', 'Leg', 2, 1)],
  )).toEqual([]);
});

test('a new pattern part is added at the end', () => {
  expect(diffProjectWithPattern([part('a', 'Head', 0, 'H')], [pp('H', 'Head', 1, 0), pp('T', 'Tail', 1, 1, 12)])).toEqual([
    { key: 'add:T:0', kind: 'add', patternPartId: 'T', name: 'Tail', totalRows: 12, afterPartId: null },
  ]);
});

test('a higher count adds the missing numbered parts after the last one', () => {
  expect(diffProjectWithPattern(
    [part('b', 'Leg 1', 0, 'L'), part('c', 'Leg 2', 1, 'L')],
    [pp('L', 'Leg', 3, 0)],
  )).toEqual([{ key: 'add:L:2', kind: 'add', patternPartId: 'L', name: 'Leg 3', totalRows: null, afterPartId: 'c' }]);
});

test('going from 1 to 2 renames the part and adds the second', () => {
  expect(diffProjectWithPattern([part('b', 'Leg', 0, 'L')], [pp('L', 'Leg', 2, 0)])).toEqual([
    { key: 'rename:b', kind: 'rename', partId: 'b', from: 'Leg', to: 'Leg 1', defaultOn: true },
    { key: 'add:L:1', kind: 'add', patternPartId: 'L', name: 'Leg 2', totalRows: null, afterPartId: 'b' },
  ]);
});

test('a renamed pattern part renames its project parts; parts with work are not ticked by default', () => {
  const changes = diffProjectWithPattern(
    [part('b', 'Leg 1', 0, 'L', { hasWork: true }), part('c', 'Leg 2', 1, 'L')],
    [pp('L', 'Back leg', 2, 0)],
  );
  expect(changes).toEqual([
    { key: 'rename:b', kind: 'rename', partId: 'b', from: 'Leg 1', to: 'Back leg 1', defaultOn: false },
    { key: 'rename:c', kind: 'rename', partId: 'c', from: 'Leg 2', to: 'Back leg 2', defaultOn: true },
  ]);
  expect([...defaultTicks(changes)]).toEqual(['rename:c']);
});

test('changed rows are listed', () => {
  expect(diffProjectWithPattern([part('a', 'Head', 0, 'H', { total_rows: 24 })], [pp('H', 'Head', 1, 0, 28)])).toEqual([
    { key: 'rows:a', kind: 'rows', partId: 'a', name: 'Head', from: 24, to: 28 },
  ]);
});

test('a lower count, a deleted pattern part and hand-added parts', () => {
  const changes = diffProjectWithPattern(
    [
      part('b', 'Leg 1', 0, 'L'), part('c', 'Leg 2', 1, 'L'),
      part('h', 'Hat', 2, null, { from_pattern: true }),
      part('x', 'Scarf', 3, null, { from_pattern: false }),
    ],
    [pp('L', 'Leg', 1, 0)],
  );
  expect(changes).toEqual([
    { key: 'rename:b', kind: 'rename', partId: 'b', from: 'Leg 1', to: 'Leg', defaultOn: true },
    { key: 'removed:c', kind: 'removed', partId: 'c', name: 'Leg 2' },
    { key: 'removed:h', kind: 'removed', partId: 'h', name: 'Hat' },
  ]);
  expect(defaultTicks(changes)).toEqual(new Set(['rename:b']));
});

test('toRpcChanges sends the ticked changes in the database shape', () => {
  const changes = diffProjectWithPattern(
    [part('b', 'Leg', 0, 'L', { total_rows: 10 }), part('h', 'Hat', 1, null, { from_pattern: true })],
    [pp('L', 'Leg', 2, 0, 12)],
  );
  expect(toRpcChanges(changes, new Set(['rename:b', 'rows:b', 'add:L:1', 'removed:h']))).toEqual([
    { kind: 'rename', part_id: 'b', name: 'Leg 1' },
    { kind: 'rows', part_id: 'b', total_rows: 12 },
    { kind: 'add', pattern_part_id: 'L', name: 'Leg 2', total_rows: 12, after_part_id: 'b' },
    { kind: 'delete', part_id: 'h' },
  ]);
  expect(toRpcChanges(changes, new Set())).toEqual([]);
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npx vitest run src/features/projects/patternDiff.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

Create `src/features/projects/patternDiff.ts`:

```ts
export type DiffPart = {
  id: string; name: string; position: number; total_rows: number | null;
  pattern_part_id: string | null; from_pattern: boolean; hasWork: boolean;
};
export type DiffPatternPart = { id: string; name: string; count: number; total_rows: number | null; position: number };
export type PatternChange =
  | { key: string; kind: 'add'; patternPartId: string; name: string; totalRows: number | null; afterPartId: string | null }
  | { key: string; kind: 'rename'; partId: string; from: string; to: string; defaultOn: boolean }
  | { key: string; kind: 'rows'; partId: string; name: string; from: number | null; to: number | null }
  | { key: string; kind: 'removed'; partId: string; name: string };

/** The project name of copy i (0-based) of a pattern part: the name alone when count is 1, else "Name i+1". */
const copyName = (p: DiffPatternPart, i: number) => (p.count === 1 ? p.name : `${p.name} ${i + 1}`);

/** What differs between a project's parts and its pattern's current parts. Rows, time and yarn are not compared. */
export function diffProjectWithPattern(parts: DiffPart[], patternParts: DiffPatternPart[]): PatternChange[] {
  const changes: PatternChange[] = [];
  const known = new Set(patternParts.map((p) => p.id));
  const byPosition = [...parts].sort((a, b) => a.position - b.position);

  for (const pp of [...patternParts].sort((a, b) => a.position - b.position)) {
    const linked = byPosition.filter((p) => p.pattern_part_id === pp.id);
    linked.slice(0, pp.count).forEach((part, i) => {
      const to = copyName(pp, i);
      if (part.name !== to) changes.push({ key: `rename:${part.id}`, kind: 'rename', partId: part.id, from: part.name, to, defaultOn: !part.hasWork });
      if (part.total_rows !== pp.total_rows) changes.push({ key: `rows:${part.id}`, kind: 'rows', partId: part.id, name: part.name, from: part.total_rows, to: pp.total_rows });
    });
    const last = linked.length > 0 ? linked[Math.min(linked.length, pp.count) - 1].id : null;
    for (let i = linked.length; i < pp.count; i++) {
      changes.push({ key: `add:${pp.id}:${i}`, kind: 'add', patternPartId: pp.id, name: copyName(pp, i), totalRows: pp.total_rows, afterPartId: last });
    }
    for (const extra of linked.slice(pp.count)) {
      changes.push({ key: `removed:${extra.id}`, kind: 'removed', partId: extra.id, name: extra.name });
    }
  }

  for (const part of byPosition) {
    if (part.from_pattern && (part.pattern_part_id === null || !known.has(part.pattern_part_id))) {
      changes.push({ key: `removed:${part.id}`, kind: 'removed', partId: part.id, name: part.name });
    }
  }
  return changes;
}

/** Ticked by default: additions, row changes and renames of untouched parts. Removals default to "keep". */
export function defaultTicks(changes: PatternChange[]): Set<string> {
  return new Set(changes.filter((c) => (c.kind === 'rename' ? c.defaultOn : c.kind !== 'removed')).map((c) => c.key));
}

/** The ticked changes in the shape `apply_pattern_update` expects. */
export function toRpcChanges(changes: PatternChange[], ticked: Set<string>): Record<string, unknown>[] {
  return changes.filter((c) => ticked.has(c.key)).map((c) => {
    switch (c.kind) {
      case 'add': return { kind: 'add', pattern_part_id: c.patternPartId, name: c.name, total_rows: c.totalRows, after_part_id: c.afterPartId };
      case 'rename': return { kind: 'rename', part_id: c.partId, name: c.to };
      case 'rows': return { kind: 'rows', part_id: c.partId, total_rows: c.to };
      case 'removed': return { kind: 'delete', part_id: c.partId };
    }
  });
}
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run src/features/projects/patternDiff.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/projects/patternDiff.ts src/features/projects/patternDiff.test.ts
git commit -m "feat: compare a project's parts with its pattern

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: "Update from pattern" on the project page

**Files:**
- Modify: `src/features/projects/api.ts` (`useApplyPatternUpdate`)
- Create: `src/features/projects/UpdateFromPattern.tsx`, `src/features/projects/UpdateFromPattern.test.tsx`
- Modify: `src/features/projects/ProjectPage.tsx`, `src/features/projects/ProjectPage.test.tsx`

**Interfaces:**
- Consumes: RPC `apply_pattern_update` (Task 1); `diffProjectWithPattern`, `defaultTicks`, `toRpcChanges`, `PatternChange` (Task 8); `usePattern` (patterns API); `ProjectDetail`, `ProjectPart`; `ConfirmDialog`, `ErrorBox`.
- Produces:
  - `useApplyPatternUpdate()` — mutation `{ projectId: string; changes: Record<string, unknown>[] }`.
  - `<UpdateFromPattern project onClose />` — `project: ProjectDetail` (with a pattern), `onClose()`.

- [ ] **Step 1: Add the mutation**

Append to `src/features/projects/api.ts`:

```ts
export function useApplyPatternUpdate() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async ({ projectId, changes }: { projectId: string; changes: Record<string, unknown>[] }) => {
      const { error } = await supabase.rpc('apply_pattern_update', { p_project_id: projectId, p_changes: changes });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/features/projects/UpdateFromPattern.test.tsx`:

```tsx
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test/render';
import type { ProjectDetail } from './api';
import UpdateFromPattern from './UpdateFromPattern';

const apply = vi.fn();
const fixture = vi.hoisted(() => ({ patternParts: [] as unknown[] }));
vi.mock('../patterns/api', () => ({
  usePattern: () => ({ data: { id: 'pa1', parts: fixture.patternParts }, error: null }),
}));
vi.mock('./api', () => ({ useApplyPatternUpdate: () => ({ mutate: apply, isPending: false, error: null }) }));

const part = (id: string, name: string, position: number, pp: string | null, extra = {}) => ({
  id, name, position, pattern_part_id: pp, from_pattern: pp !== null, done: false, current_row: null, total_rows: null,
  time_sessions: [], part_yarns: [], ...extra,
});
const project = (parts: unknown[]) => ({ id: 'pr1', pattern: { id: 'pa1', name: 'T-rex', hook_size_mm: null }, parts }) as unknown as ProjectDetail;
const pp = (id: string, name: string, count: number, position: number) => ({ id, name, count, position, total_rows: null });

beforeEach(() => apply.mockReset());

test('lists the changes, ticked by default except removals, and applies the ticked ones', async () => {
  fixture.patternParts = [pp('H', 'Head', 1, 0), pp('L', 'Back leg', 1, 1), pp('T', 'Tail', 1, 2)];
  const onClose = vi.fn();
  apply.mockImplementation((_v, opts) => opts.onSuccess());
  renderWithProviders(<UpdateFromPattern project={project([
    part('a', 'Head', 0, 'H'), part('b', 'Leg', 1, 'L'), part('h', 'Hat', 2, null, { from_pattern: true }),
  ])} onClose={onClose} />);

  expect(screen.getByRole('checkbox', { name: 'Rename Leg → Back leg' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'New part: Tail' })).toBeChecked();
  expect(screen.getByRole('checkbox', { name: 'Hat is no longer in the pattern — delete it' })).not.toBeChecked();

  await userEvent.click(screen.getByRole('checkbox', { name: 'Rename Leg → Back leg' }));
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(apply).toHaveBeenCalledWith({
    projectId: 'pr1',
    changes: [{ kind: 'add', pattern_part_id: 'T', name: 'Tail', total_rows: null, after_part_id: null }],
  }, expect.anything());
  expect(onClose).toHaveBeenCalled();
});

test('deleting parts asks for confirmation first', async () => {
  fixture.patternParts = [pp('H', 'Head', 1, 0)];
  renderWithProviders(<UpdateFromPattern project={project([
    part('a', 'Head', 0, 'H'), part('h', 'Hat', 1, null, { from_pattern: true }),
  ])} onClose={() => {}} />);
  await userEvent.click(screen.getByRole('checkbox', { name: 'Hat is no longer in the pattern — delete it' }));
  await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
  expect(apply).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog', { name: 'Delete 1 part?' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
  expect(apply).toHaveBeenCalledWith({ projectId: 'pr1', changes: [{ kind: 'delete', part_id: 'h' }] }, expect.anything());
});

test('says when there is nothing to update', () => {
  fixture.patternParts = [pp('H', 'Head', 1, 0)];
  renderWithProviders(<UpdateFromPattern project={project([part('a', 'Head', 0, 'H')])} onClose={() => {}} />);
  expect(screen.getByText('Nothing to update.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
});
```

In `src/features/projects/ProjectPage.test.tsx`:
1. Add near the other mocks:

```tsx
vi.mock('./UpdateFromPattern', () => ({ default: () => <p>update panel</p> }));
```

2. Add:

```tsx
test('"Update from pattern" opens the update panel', async () => {
  renderWithProviders(<ProjectPage />, { route: '/projects/pr1', path: '/projects/:id' });
  await userEvent.click(screen.getByRole('button', { name: 'Update from pattern' }));
  expect(screen.getByText('update panel')).toBeInTheDocument();
});
```

(Use the same `renderWithProviders(…)` call the other tests in this file use, if it differs.)

- [ ] **Step 3: Run to see them fail**

Run: `npx vitest run src/features/projects/UpdateFromPattern.test.tsx src/features/projects/ProjectPage.test.tsx`
Expected: FAIL (component missing; no button).

- [ ] **Step 4: Implement the panel**

Create `src/features/projects/UpdateFromPattern.tsx`:

```tsx
import { useState } from 'react';
import ConfirmDialog from '../../components/ConfirmDialog';
import ErrorBox from '../../components/ErrorBox';
import { usePattern } from '../patterns/api';
import { useApplyPatternUpdate, type ProjectDetail } from './api';
import { defaultTicks, diffProjectWithPattern, toRpcChanges, type PatternChange } from './patternDiff';

function changeLabel(c: PatternChange): string {
  switch (c.kind) {
    case 'add': return `New part: ${c.name}`;
    case 'rename': return `Rename ${c.from} → ${c.to}`;
    case 'rows': return `${c.name}: rows ${c.from ?? '—'} → ${c.to ?? '—'}`;
    case 'removed': return `${c.name} is no longer in the pattern — delete it`;
  }
}

/** Preview of what changed in the pattern; nothing is applied until "Apply". */
export default function UpdateFromPattern({ project, onClose }: { project: ProjectDetail; onClose: () => void }) {
  const pattern = usePattern(project.pattern?.id);
  const apply = useApplyPatternUpdate();
  const [ticked, setTicked] = useState<Set<string> | null>(null);
  const [confirming, setConfirming] = useState(false);

  if (pattern.error) return <ErrorBox error={pattern.error} />;
  if (!pattern.data) return <p className="text-muted">Loading…</p>;

  const changes = diffProjectWithPattern(
    project.parts.map((p) => ({
      id: p.id, name: p.name, position: p.position, total_rows: p.total_rows, pattern_part_id: p.pattern_part_id,
      from_pattern: p.from_pattern,
      hasWork: p.done || (p.current_row ?? 0) > 0 || p.time_sessions.length > 0 || p.part_yarns.length > 0,
    })),
    pattern.data.parts,
  );
  const on = ticked ?? defaultTicks(changes);
  const deletions = changes.filter((c) => c.kind === 'removed' && on.has(c.key)).length;
  const toggle = (key: string) => {
    const next = new Set(on);
    if (next.has(key)) next.delete(key); else next.add(key);
    setTicked(next);
  };
  const run = () => apply.mutate({ projectId: project.id, changes: toRpcChanges(changes, on) }, { onSuccess: onClose });

  return (
    <section aria-label="Update from pattern" className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3">
      <h2 className="text-sm uppercase tracking-wide text-muted">Update from pattern</h2>
      {apply.error && <ErrorBox error={apply.error} />}
      {changes.length === 0 ? (
        <p className="text-muted">Nothing to update.</p>
      ) : (
        <>
          <p className="text-sm text-muted">Rows done, time and yarn used are never changed.</p>
          {changes.map((c) => (
            <label key={c.key} className="flex min-h-11 items-center gap-2">
              <input type="checkbox" checked={on.has(c.key)} onChange={() => toggle(c.key)} className="h-5 w-5 accent-projects" />
              <span>{changeLabel(c)}</span>
            </label>
          ))}
        </>
      )}
      <div className="flex gap-2">
        {changes.length > 0 && (
          <button type="button" disabled={apply.isPending || on.size === 0}
            onClick={() => (deletions > 0 ? setConfirming(true) : run())}
            className="h-11 rounded-full bg-projects px-5 text-white">Apply</button>
        )}
        <button type="button" onClick={onClose} className="h-11 rounded-full border border-line px-5">Cancel</button>
      </div>
      <ConfirmDialog
        open={confirming}
        title={`Delete ${deletions} ${deletions === 1 ? 'part' : 'parts'}?`}
        message="Their time and yarn records are deleted too."
        confirmLabel="Delete"
        onCancel={() => setConfirming(false)}
        onConfirm={() => { setConfirming(false); run(); }}
      />
    </section>
  );
}
```

Note: the checkbox's accessible name is the text of its `<label>`, which is exactly `changeLabel(c)`.

- [ ] **Step 5: Add the button to the project page**

In `src/features/projects/ProjectPage.tsx`:
1. Add `import UpdateFromPattern from './UpdateFromPattern';`.
2. Add state next to the others: `const [updating, setUpdating] = useState(false);`.
3. Immediately before the `<div className="flex items-baseline justify-between">` that holds the `Parts · …` heading, insert:

```tsx
      {p.pattern && (updating ? (
        <UpdateFromPattern project={p} onClose={() => setUpdating(false)} />
      ) : (
        <button type="button" onClick={() => setUpdating(true)}
          className="h-11 self-start rounded-full border border-line px-5 text-projects">Update from pattern</button>
      ))}
```

- [ ] **Step 6: Run the tests and the build**

Run: `npx vitest run src/features/projects` then `npm run build`
Expected: PASS; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/features/projects
git commit -m "feat: update a project from its pattern with a preview of the changes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: End-to-end test for Phase 1.2

**Files:**
- Create: `e2e/phase-1-2.spec.ts`

**Interfaces:**
- Consumes: every label from Tasks 2–9: "Paste yarns", "Import yarns", "Brand", "Name", "Weight", "Pink" (radio), "Skeins owned", "Search yarns", "+ Yarn", "Colour", "Skeins", "+ Material", "Material", "Quantity", "Start a project from this pattern", "Choose yarn for Pink", "Start project", "Update from pattern", "New part: Tail", "Apply".

- [ ] **Step 1: Write the test**

Create `e2e/phase-1-2.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.test' });
const url = process.env.VITE_SUPABASE_URL!;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const storageKey = `sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
let userId: string;

test.beforeEach(async ({ page }) => {
  const email = `e2e-${crypto.randomUUID()}@example.com`;
  const password = `pw-${crypto.randomUUID()}`;
  const { data } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  userId = data.user!.id;
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data: signIn } = await client.auth.signInWithPassword({ email, password });
  // Sign the browser in without an email round-trip by seeding supabase-js's stored session.
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [storageKey, JSON.stringify(signIn.session)]);
});

test.afterEach(async () => {
  await admin.auth.admin.deleteUser(userId);
});

test('lists → yarn with suggestions → stash search → pattern materials → project yarns → update from pattern', async ({ page }) => {
  // Paste the user's yarn list
  await page.goto('/stash/lists');
  await page.getByLabel('Paste yarns').fill([
    'Hobbii ; Honey Bunny ; Super Bulky ; Polyester',
    'Hobbii ; Baby Snuggle ; Super Bulky ; Polyester',
    'Hobbii ; Toucan ; Super Bulky ; Polyester',
  ].join('\n'));
  await page.getByRole('button', { name: 'Import yarns' }).click();
  await expect(page.getByRole('status')).toHaveText('3 added, 0 already there');

  // A yarn from the suggestions
  await page.goto('/stash/new');
  await page.getByLabel('Brand').fill('Hob');
  await page.getByRole('option', { name: 'Hobbii' }).click();
  await page.getByLabel('Name', { exact: true }).click();
  await page.getByRole('option', { name: 'Honey Bunny' }).click();
  await expect(page.getByLabel('Weight')).toHaveValue('super_bulky');
  await expect(page.getByLabel('Fiber')).toHaveValue('Polyester');
  await page.getByRole('radio', { name: 'Pink' }).click();
  await page.getByLabel('Skeins owned').fill('3');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Honey Bunny' })).toBeVisible();

  // Find it in the stash by search and by colour
  await page.goto('/stash');
  await page.getByLabel('Search yarns').fill('bunny');
  await expect(page.getByRole('link', { name: /Honey Bunny/ })).toBeVisible();
  await page.getByLabel('Search yarns').fill('');
  await page.getByRole('radio', { name: 'Pink' }).click();
  await expect(page.getByRole('link', { name: /Honey Bunny/ })).toBeVisible();

  // A pattern with materials
  await page.goto('/patterns/new');
  await page.getByLabel('Name', { exact: true }).fill('Bunny');
  await page.getByLabel('Part name').first().fill('Body');
  await page.getByRole('button', { name: '+ Yarn' }).click();
  await page.getByLabel('Colour', { exact: true }).fill('Pink');
  await page.getByRole('radio', { name: 'Pink' }).click();
  await page.getByLabel('Skeins', { exact: true }).fill('2');
  await page.getByRole('button', { name: '+ Material' }).click();
  await page.getByLabel('Material', { exact: true }).fill('Safety eyes 10 mm');
  await page.getByLabel('Quantity').fill('2');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Pink · 2 skeins')).toBeVisible();
  await expect(page.getByText('Safety eyes 10 mm × 2')).toBeVisible();

  // Start a project, planning Honey Bunny for the pink line
  await page.getByRole('button', { name: 'Start a project from this pattern' }).click();
  await page.getByRole('button', { name: 'Choose yarn for Pink' }).click();
  await page.getByRole('button', { name: /Honey Bunny/ }).click();
  await page.getByRole('button', { name: 'Start project' }).click();
  await expect(page.getByRole('link', { name: /Body/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Honey Bunny/ })).toContainText('0 / 2');
  const projectUrl = page.url();

  // Add a part to the pattern, then update the project from it
  await page.getByRole('link', { name: 'Bunny', exact: true }).click();
  await page.getByRole('link', { name: 'Edit' }).click();
  await page.getByRole('button', { name: '+ Add part' }).click();
  await page.getByLabel('Part name').nth(1).fill('Tail');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('link', { name: 'Instructions · 0' })).toHaveCount(2);
  await page.goto(projectUrl);
  await page.getByRole('button', { name: 'Update from pattern' }).click();
  await expect(page.getByRole('checkbox', { name: 'New part: Tail' })).toBeChecked();
  await page.getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByRole('link', { name: /Tail/ })).toBeVisible();
});
```

Notes for the implementer:
- The project page links to its pattern with the pattern's name ("From Bunny"); if that link's accessible name differs, use the locator that matches the code, not the other way round.
- `fill` on a `NumberField` commits when focus leaves it; the following click does that.

- [ ] **Step 2: Run the end-to-end tests**

Run: `npm run db:reset` then `npm run e2e`
Expected: both `main-flow.spec.ts` and `phase-1-2.spec.ts` PASS. Leave no dev server running afterwards.

- [ ] **Step 3: Run every suite once more**

Run: `npx vitest run`, `npm run test:db`, `npm run build`
Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add e2e/phase-1-2.spec.ts
git commit -m "test: end-to-end covers lists, suggestions, materials, project yarns and pattern updates

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
