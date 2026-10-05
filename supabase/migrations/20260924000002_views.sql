create view public.yarn_stock with (security_invoker = true) as
with usage as (
  select pt.project_id, pr.status, py.yarn_id, sum(py.skeins_used) as used
  from public.part_yarns py
  join public.parts pt on pt.id = py.part_id
  join public.projects pr on pr.id = pt.project_id
  group by pt.project_id, pr.status, py.yarn_id
),
used as (
  select yarn_id, sum(used) as used
  from usage
  where status <> 'frogged'
  group by yarn_id
),
reserved as (
  select pj.yarn_id, sum(greatest(pj.skeins_planned - coalesce(u.used, 0), 0)) as reserved
  from public.project_yarns pj
  join public.projects pr on pr.id = pj.project_id
  left join usage u on u.project_id = pj.project_id and u.yarn_id = pj.yarn_id
  where pr.status in ('idea', 'in_progress')
  group by pj.yarn_id
)
select
  y.id as yarn_id,
  y.user_id,
  y.skeins_owned as owned,
  coalesce(u.used, 0) as used,
  coalesce(r.reserved, 0) as reserved,
  y.skeins_owned - coalesce(u.used, 0) - coalesce(r.reserved, 0) as free
from public.yarns y
left join used u on u.yarn_id = y.id
left join reserved r on r.yarn_id = y.id;

create view public.project_summary with (security_invoker = true) as
select
  pr.id as project_id,
  pr.user_id,
  (select count(*) from public.parts p where p.project_id = pr.id)::int as parts_total,
  (select count(*) from public.parts p where p.project_id = pr.id and p.done)::int as parts_done,
  (select coalesce(sum(extract(epoch from coalesce(ts.ended_at, now()) - ts.started_at)), 0)
     from public.time_sessions ts join public.parts p on p.id = ts.part_id
     where p.project_id = pr.id)::bigint as seconds,
  (select coalesce(sum(py.skeins_used), 0)
     from public.part_yarns py join public.parts p on p.id = py.part_id
     where p.project_id = pr.id) as skeins
from public.projects pr;

create view public.pattern_stats with (security_invoker = true) as
select
  pa.id as pattern_id,
  pa.user_id,
  count(ps.project_id)::int as times_made,
  round(avg(ps.seconds))::bigint as avg_seconds,
  round(avg(ps.skeins), 2) as avg_skeins
from public.patterns pa
left join public.projects pr on pr.pattern_id = pa.id and pr.status = 'finished'
left join public.project_summary ps on ps.project_id = pr.id
group by pa.id, pa.user_id;
