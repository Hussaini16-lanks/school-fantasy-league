-- =====================================================================
--  PAU Fantasy — one manager's squad + points for one gameweek (Step 4A+)
--  Run ONCE in Supabase → SQL Editor (new query).
-- =====================================================================

create or replace function public.manager_gameweek_detail(p_user uuid, p_gw int)
returns table (
  player_id        int,
  is_starter       boolean,
  bench_order      int,
  is_captain       boolean,
  is_vice_captain  boolean,
  played           boolean,
  points           int,      -- the player's own fantasy points that gameweek
  counts           boolean,  -- did his points count for this manager?
  multiplier       int       -- 2 for the (acting) captain, otherwise 1
)
language sql stable security definer
set search_path = ''
as $$
  with
  -- the squad that counted that week (carries over if no new one was saved)
  source as (
    select pk.gameweek_id as gw
    from public.picks pk
    join public.gameweeks g on g.id = pk.gameweek_id
    where pk.user_id = p_user
      and g.deadline <= (select g2.deadline from public.gameweeks g2 where g2.id = p_gw)
    order by g.deadline desc
    limit 1
  ),
  player_gw as (
    select pfp.player_id, sum(pfp.fantasy_points)::int as pts
    from public.player_fixture_points pfp
    where pfp.gameweek_id = p_gw
    group by pfp.player_id
  ),
  squad as (
    select pk.player_id, pk.is_starter, pk.bench_order, pk.is_captain, pk.is_vice_captain,
           (pg.pts is not null) as played,
           coalesce(pg.pts, 0) as pts
    from public.picks pk
    left join player_gw pg on pg.player_id = pk.player_id
    where pk.user_id = p_user
      and pk.gameweek_id = (select gw from source)
  ),
  missing as (
    select count(*) filter (where s.is_starter and not s.played) as n from squad s
  ),
  bench_in as (
    select b.player_id
    from (select s.player_id, row_number() over (order by s.bench_order) as rn
          from squad s where not s.is_starter and s.played) b
    where b.rn <= (select n from missing)
  ),
  acting_captain as (
    select coalesce(
      (select s.player_id from squad s where s.is_captain and s.played),
      (select s.player_id from squad s where s.is_vice_captain and s.played)
    ) as id
  )
  select s.player_id, s.is_starter, s.bench_order, s.is_captain, s.is_vice_captain,
         s.played, s.pts,
         ((s.is_starter and s.played) or s.player_id in (select player_id from bench_in)) as counts,
         case when s.player_id = (select id from acting_captain) then 2 else 1 end as multiplier
  from squad s
  order by s.is_starter desc, s.bench_order nulls first;
$$;

grant execute on function public.manager_gameweek_detail(uuid, int) to anon, authenticated;