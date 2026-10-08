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
  with candidates as (
    select distinct on (pt.id) pt.id as part_id, pp.id as pattern_part_id
    from public.parts pt
    join public.projects pr on pr.id = pt.project_id and pr.pattern_id is not null
    join public.pattern_parts pp on pp.pattern_id = pr.pattern_id and pp.user_id = pt.user_id
    where pt.pattern_part_id is null
      and (
        pt.name = pp.name
        or (pp.count > 1
            and left(pt.name, length(pp.name) + 1) = pp.name || ' '
            and substring(pt.name from length(pp.name) + 2) ~ '^[0-9]+$')
      )
    order by pt.id, (pt.name = pp.name) desc, pp.position
  )
  update public.parts p set pattern_part_id = c.pattern_part_id
  from candidates c where p.id = c.part_id;
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
