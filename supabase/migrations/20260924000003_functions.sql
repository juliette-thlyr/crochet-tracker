create function public.start_project_from_pattern(p_pattern_id uuid) returns uuid
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

  return v_project;
end $$;

create function public.add_main_part() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if new.pattern_id is null then
    insert into public.parts (project_id, user_id, name, position) values (new.id, new.user_id, 'Main', 0);
  end if;
  return new;
end $$;

create trigger add_main_part after insert on public.projects
  for each row execute function public.add_main_part();

create function public.set_finish_date() returns trigger
language plpgsql as $$
begin
  if new.status = 'finished' and new.finish_date is null
     and (tg_op = 'INSERT' or old.status is distinct from 'finished') then
    new.finish_date := current_date;
  end if;
  return new;
end $$;

create trigger set_finish_date before insert or update on public.projects
  for each row execute function public.set_finish_date();

create function public.start_timer(p_part_id uuid) returns public.time_sessions
language plpgsql security invoker set search_path = public as $$
declare
  v_session public.time_sessions;
begin
  update public.time_sessions set ended_at = now()
  where user_id = auth.uid() and ended_at is null;

  insert into public.time_sessions (part_id) values (p_part_id)
  returning * into v_session;
  return v_session;
end $$;

create function public.stop_timer() returns void
language sql security invoker set search_path = public as $$
  update public.time_sessions set ended_at = now()
  where user_id = auth.uid() and ended_at is null;
$$;
