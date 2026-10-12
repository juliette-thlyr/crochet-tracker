-- Each list is fed only when its own column changed, so a fiber edit does not bring back
-- a catalog entry or shop the user removed.
create or replace function public.add_yarn_to_lists() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if nullif(trim(new.brand), '') is not null
     and (tg_op = 'INSERT' or old.brand is distinct from new.brand or old.name is distinct from new.name) then
    insert into public.catalog_yarns (user_id, brand, name, yarn_weight, fiber)
    values (new.user_id, trim(new.brand), trim(new.name), new.yarn_weight, nullif(trim(new.fiber), ''))
    on conflict do nothing;
  end if;
  if nullif(trim(new.bought_at), '') is not null
     and (tg_op = 'INSERT' or old.bought_at is distinct from new.bought_at) then
    insert into public.shops (user_id, name) values (new.user_id, trim(new.bought_at)) on conflict do nothing;
  end if;
  if nullif(trim(new.fiber), '') is not null
     and (tg_op = 'INSERT' or old.fiber is distinct from new.fiber) then
    insert into public.fibers (user_id, name) values (new.user_id, trim(new.fiber)) on conflict do nothing;
  end if;
  return new;
end $$;
