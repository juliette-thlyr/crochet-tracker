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
