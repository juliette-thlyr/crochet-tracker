-- An UPDATE OF trigger fires whenever a column is in the SET list, even when unchanged.
-- Only add to the lists when the relevant values actually change, so removed or renamed
-- list entries are not re-added by unrelated yarn edits.
drop trigger add_yarn_to_lists on public.yarns;

create trigger add_yarn_to_lists_insert after insert on public.yarns
  for each row execute function public.add_yarn_to_lists();

create trigger add_yarn_to_lists_update after update on public.yarns
  for each row
  when (old.brand is distinct from new.brand or old.name is distinct from new.name
    or old.yarn_weight is distinct from new.yarn_weight or old.fiber is distinct from new.fiber
    or old.bought_at is distinct from new.bought_at)
  execute function public.add_yarn_to_lists();
