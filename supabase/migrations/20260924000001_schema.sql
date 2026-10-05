create type public.yarn_weight as enum
  ('lace', 'fingering', 'sport', 'dk', 'worsted', 'aran', 'bulky', 'super_bulky', 'jumbo');
create type public.project_status as enum ('idea', 'in_progress', 'finished', 'frogged');

create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create table public.pattern_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (length(trim(name)) > 0),
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (length(trim(name)) > 0),
  pattern_type_id uuid references public.pattern_types on delete set null,
  designer text,
  url text,
  hook_size_mm numeric(3,1)
    check (hook_size_mm between 1.0 and 12.0 and hook_size_mm * 2 = floor(hook_size_mm * 2)),
  yarn_weight public.yarn_weight,
  notes text,
  pdf_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pattern_parts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  pattern_id uuid not null references public.patterns on delete cascade,
  name text not null check (length(trim(name)) > 0),
  position int not null default 0,
  count int not null default 1 check (count >= 1),
  total_rows int check (total_rows >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.yarns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  brand text,
  name text not null check (length(trim(name)) > 0),
  color text,
  yarn_weight public.yarn_weight,
  fiber text,
  skeins_owned numeric(6,2) not null default 0 check (skeins_owned >= 0),
  photo_path text,
  bought_at text,
  price_per_skein numeric(8,2) check (price_per_skein >= 0),
  bought_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (length(trim(name)) > 0),
  pattern_id uuid references public.patterns on delete set null,
  status public.project_status not null default 'idea',
  start_date date,
  finish_date date,
  hook_size_mm numeric(3,1)
    check (hook_size_mm between 1.0 and 12.0 and hook_size_mm * 2 = floor(hook_size_mm * 2)),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  project_id uuid not null references public.projects on delete cascade,
  path text not null,
  caption text,
  taken_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.parts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  project_id uuid not null references public.projects on delete cascade,
  name text not null check (length(trim(name)) > 0),
  position int not null default 0,
  done boolean not null default false,
  current_row int check (current_row >= 0),
  total_rows int check (total_rows >= 1),
  resume_note text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.time_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  part_id uuid not null references public.parts on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ended_at is null or ended_at > started_at)
);
create unique index one_running_timer on public.time_sessions (user_id) where ended_at is null;

create table public.part_yarns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  part_id uuid not null references public.parts on delete cascade,
  yarn_id uuid not null references public.yarns on delete restrict,
  skeins_used numeric(6,2) not null default 0 check (skeins_used >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (part_id, yarn_id)
);

create table public.project_yarns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  project_id uuid not null references public.projects on delete cascade,
  yarn_id uuid not null references public.yarns on delete restrict,
  skeins_planned numeric(6,2) not null check (skeins_planned >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, yarn_id)
);

create index on public.patterns (pattern_type_id);
create index on public.pattern_parts (pattern_id);
create index on public.projects (pattern_id);
create index on public.project_photos (project_id);
create index on public.parts (project_id);
create index on public.time_sessions (part_id);
create index on public.part_yarns (yarn_id);
create index on public.project_yarns (yarn_id);

do $$
declare t text;
begin
  foreach t in array array['pattern_types', 'patterns', 'pattern_parts', 'yarns', 'projects',
                           'project_photos', 'parts', 'time_sessions', 'part_yarns', 'project_yarns']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy owner_all on public.%I for all to authenticated
         using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

create function public.seed_pattern_types() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.pattern_types (user_id, name, position) values
    (new.id, 'Amigurumi', 0), (new.id, 'Clothes', 1), (new.id, 'Accessories', 2),
    (new.id, 'Bag', 3), (new.id, 'Home', 4), (new.id, 'Baby', 5);
  return new;
end $$;

create trigger seed_pattern_types after insert on auth.users
  for each row execute function public.seed_pattern_types();
