-- A yarn can belong to up to two colour families (teal = blue + green).
-- Existing single families are kept as a one-item list.
alter table public.yarns
  add column color_families public.colour_family[] not null default '{}'
  check (cardinality(color_families) <= 2);

update public.yarns set color_families = array[color_family] where color_family is not null;

alter table public.yarns drop column color_family;
