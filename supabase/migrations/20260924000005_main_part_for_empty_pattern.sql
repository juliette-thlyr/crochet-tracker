-- A pattern without parts still gives its project a "Main" part, like a blank project.
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
    select name, count, total_rows from public.pattern_parts
    where pattern_id = p_pattern_id order by position, created_at
  loop
    for i in 1..v_part.count loop
      insert into public.parts (project_id, name, position, total_rows)
      values (
        v_project,
        case when v_part.count = 1 then v_part.name else v_part.name || ' ' || i end,
        v_pos,
        v_part.total_rows
      );
      v_pos := v_pos + 1;
    end loop;
  end loop;

  if v_pos = 0 then
    insert into public.parts (project_id, name, position) values (v_project, 'Main', 0);
  end if;

  return v_project;
end $$;
