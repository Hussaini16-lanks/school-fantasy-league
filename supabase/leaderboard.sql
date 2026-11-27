-- =====================================================================
--  PAU Fantasy — manager scoring + leaderboard (Step 4A)
--  Run ONCE in Supabase → SQL Editor (new query).
-- =====================================================================


-- Every manager's score in every gameweek that has stats.
-- Rules: starters score · auto-subs (bench order) replace starters who didn't play
--        captain x2 (vice-captain if captain didn't play) · +5 per game attended
--        no new squad saved = last saved squad carries over
create or replace function public.manager_points()
returns table (
  user_id           uuid,
  gameweek_id       int,
  squad_points      int,
  attendance_points int,
  total_points      int
)
language sql stable security definer
set search_path = ''
as $$
  with
  managers as (
    select distinct pk.user_id from public.picks pk
  ),
  played_gws as (
    select distinct pfp.gameweek_id from public.player_fixture_points pfp
  ),
  -- which saved squad counts for each manager in each gameweek
  squad_source as (
    select m.user_id, pg.gameweek_id,
      (select pk.gameweek_id
       from public.picks pk
       join public.gameweeks g2 on g2.id = pk.gameweek_id
       where pk.user_id = m.user_id
         and g2.deadline <= (select g3.deadline from public.gameweeks g3 where g3.id = pg.gameweek_id)
       order by g2.deadline desc
       limit 1) as source_gw
    from managers m
    cross join played_gws pg
  ),
  -- each player's fantasy points per gameweek
  player_gw as (
    select pfp.player_id, pfp.gameweek_id, sum(pfp.fantasy_points)::int as pts
    from public.player_fixture_points pfp
    group by pfp.player_id, pfp.gameweek_id
  ),
  -- the 10-man squad, with who played and their points
  squad as (
    select ss.user_id, ss.gameweek_id, pk.player_id, pk.is_starter, pk.bench_order,
           pk.is_captain, pk.is_vice_captain,
           (pg.pts is not null) as played,
           coalesce(pg.pts, 0) as pts
    from squad_source ss
    join public.picks pk on pk.user_id = ss.user_id and pk.gameweek_id = ss.source_gw
    left join player_gw pg on pg.player_id = pk.player_id and pg.gameweek_id = ss.gameweek_id
  ),
  -- how many starters didn't play
  missing as (
    select s.user_id, s.gameweek_id, count(*) filter (where s.is_starter and not s.played) as n
    from squad s
    group by s.user_id, s.gameweek_id
  ),
  -- bench players who played, in bench order
  ranked_bench as (
    select s.user_id, s.gameweek_id, s.pts,
           row_number() over (partition by s.user_id, s.gameweek_id order by s.bench_order) as rn
    from squad s
    where not s.is_starter and s.played
  ),
  -- the 5 who actually score: starters who played + auto-subs
  lineup as (
    select s.user_id, s.gameweek_id, s.pts
    from squad s
    where s.is_starter and s.played
    union all
    select rb.user_id, rb.gameweek_id, rb.pts
    from ranked_bench rb
    join missing m on m.user_id = rb.user_id and m.gameweek_id = rb.gameweek_id
    where rb.rn <= m.n
  ),
  lineup_totals as (
    select l.user_id, l.gameweek_id, sum(l.pts)::int as pts
    from lineup l
    group by l.user_id, l.gameweek_id
  ),
  -- captain's points again (= double), or the vice's if the captain didn't play
  captaincy as (
    select s.user_id, s.gameweek_id,
           coalesce(max(s.pts) filter (where s.is_captain and s.played),
                    max(s.pts) filter (where s.is_vice_captain and s.played),
                    0)::int as bonus
    from squad s
    group by s.user_id, s.gameweek_id
  ),
  -- +5 for every game attended
  attended as (
    select a.user_id, f.gameweek_id, (5 * count(*))::int as bonus
    from public.attendance a
    join public.fixtures f on f.id = a.fixture_id
    group by a.user_id, f.gameweek_id
  )
  select ss.user_id,
         ss.gameweek_id,
         (coalesce(lt.pts, 0) + coalesce(c.bonus, 0))::int as squad_points,
         coalesce(at.bonus, 0)::int as attendance_points,
         (coalesce(lt.pts, 0) + coalesce(c.bonus, 0) + coalesce(at.bonus, 0))::int as total_points
  from squad_source ss
  left join lineup_totals lt on lt.user_id = ss.user_id and lt.gameweek_id = ss.gameweek_id
  left join captaincy     c  on c.user_id  = ss.user_id and c.gameweek_id  = ss.gameweek_id
  left join attended      at on at.user_id = ss.user_id and at.gameweek_id = ss.gameweek_id
  where ss.source_gw is not null;
$$;


-- The season table: everyone who has picked a squad, ranked by total points
create or replace function public.leaderboard()
returns table (
  rank          bigint,
  user_id       uuid,
  display_name  text,
  team_name     text,
  gw_points     int,
  total_points  bigint
)
language sql stable security definer
set search_path = ''
as $$
  with mp as (
    select * from public.manager_points()
  ),
  latest as (
    select max(mp.gameweek_id) as id from mp
  ),
  managers as (
    select distinct pk.user_id from public.picks pk
  )
  select rank() over (order by coalesce(sum(mp.total_points), 0) desc) as rank,
         pr.id,
         pr.display_name,
         pr.team_name,
         coalesce(max(mp.total_points) filter (where mp.gameweek_id = (select id from latest)), 0)::int,
         coalesce(sum(mp.total_points), 0)::bigint as total_points
  from managers m
  join public.profiles pr on pr.id = m.user_id
  left join mp on mp.user_id = m.user_id
  group by pr.id, pr.display_name, pr.team_name
  order by total_points desc, pr.display_name;
$$;

grant execute on function public.manager_points() to anon, authenticated;
grant execute on function public.leaderboard()    to anon, authenticated;