-- =====================================================================
--  PAU Fantasy — squad rules (Step 3B)
--  Run ONCE in Supabase → SQL Editor (new query).
-- =====================================================================


-- Which gameweek is open for picking? (the next deadline that hasn't passed)
create or replace function public.open_gameweek()
returns int
language sql stable
set search_path = ''
as $$
  select id
  from public.gameweeks
  where deadline > now()
  order by deadline
  limit 1;
$$;


-- The squad a gameweek's transfers are measured against:
-- the user's most recent squad from an EARLIER gameweek.
-- NULL = this is their first squad, so changes are unlimited.
create or replace function public.base_gameweek(p_user uuid, p_gw int)
returns int
language sql stable
set search_path = ''
as $$
  select g.id
  from public.gameweeks g
  where g.deadline < (select deadline from public.gameweeks where id = p_gw)
    and exists (
      select 1 from public.picks p
      where p.user_id = p_user and p.gameweek_id = g.id
    )
  order by g.deadline desc
  limit 1;
$$;


-- Everything the "My Team" page needs in one call
create or replace function public.get_team_state()
returns json
language plpgsql stable
set search_path = ''
as $$
declare
  v_user   uuid := auth.uid();
  v_gw     int  := public.open_gameweek();
  v_base   int;
  v_source int;
begin
  if v_user is null then
    raise exception 'You must be logged in';
  end if;

  if v_gw is null then
    return json_build_object('gameweek', null);
  end if;

  v_base := public.base_gameweek(v_user, v_gw);

  -- Show this gameweek's squad if saved, otherwise carry over last week's
  v_source := case
    when exists (select 1 from public.picks where user_id = v_user and gameweek_id = v_gw)
      then v_gw
    else v_base
  end;

  return json_build_object(
    'gameweek', (
      select row_to_json(g)
      from (select id, name, deadline from public.gameweeks where id = v_gw) g
    ),
    'budget',          100.0,
    'max_per_house',   3,
    'free_transfers',  case when v_base is null then null else 1 end,  -- null = unlimited
    'base_player_ids', coalesce(
      (select json_agg(player_id) from public.picks
       where user_id = v_user and gameweek_id = v_base),
      '[]'::json),
    'picks', coalesce(
      (select json_agg(json_build_object(
          'player_id',       player_id,
          'is_starter',      is_starter,
          'bench_order',     bench_order,
          'is_captain',      is_captain,
          'is_vice_captain', is_vice_captain))
       from public.picks
       where user_id = v_user and gameweek_id = v_source),
      '[]'::json)
  );
end;
$$;


-- Save a squad — checks EVERY rule before writing anything
create or replace function public.save_team(
  p_starters     int[],   -- 5 player ids
  p_bench        int[],   -- 5 player ids, in bench order (1st sub first)
  p_captain      int,
  p_vice_captain int
)
returns json
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user      uuid  := auth.uid();
  v_gw        int   := public.open_gameweek();
  v_all       int[] := p_starters || p_bench;
  v_base      int;
  v_cost      numeric;
  v_max_house int;
  v_transfers int := 0;
begin
  if v_user is null then
    raise exception 'You must be logged in';
  end if;
  if v_gw is null then
    raise exception 'No gameweek is open for picking right now';
  end if;

  -- Squad shape
  if coalesce(array_length(p_starters, 1), 0) <> 5 then
    raise exception 'Pick exactly 5 starters';
  end if;
  if coalesce(array_length(p_bench, 1), 0) <> 5 then
    raise exception 'Pick exactly 5 subs';
  end if;
  if (select count(distinct x) from unnest(v_all) as x) <> 10 then
    raise exception 'A player can only be picked once';
  end if;
  if (select count(*) from public.players where id = any(v_all) and active) <> 10 then
    raise exception 'One or more players are not available';
  end if;

  -- Captaincy
  if not (p_captain = any(p_starters)) then
    raise exception 'Your captain must be a starter';
  end if;
  if not (p_vice_captain = any(p_starters)) then
    raise exception 'Your vice-captain must be a starter';
  end if;
  if p_captain = p_vice_captain then
    raise exception 'Captain and vice-captain must be different players';
  end if;

  -- Budget
  select sum(price) into v_cost from public.players where id = any(v_all);
  if v_cost > 100 then
    raise exception 'Over budget: your squad costs % coins (max 100)', v_cost;
  end if;

  -- House limit
  select max(c) into v_max_house
  from (select count(*) as c from public.players
        where id = any(v_all) group by house_id) t;
  if v_max_house > 3 then
    raise exception 'You can have at most 3 players from the same house';
  end if;

  -- Transfers (only after your first squad)
  v_base := public.base_gameweek(v_user, v_gw);
  if v_base is not null then
    select count(*) into v_transfers
    from unnest(v_all) as x
    where x not in (
      select player_id from public.picks
      where user_id = v_user and gameweek_id = v_base
    );
    if v_transfers > 1 then
      raise exception 'Only 1 transfer per gameweek (you tried %)', v_transfers;
    end if;
  end if;

  -- All good: replace this gameweek's squad
  delete from public.picks where user_id = v_user and gameweek_id = v_gw;

  insert into public.picks
    (user_id, gameweek_id, player_id, is_starter, bench_order, is_captain, is_vice_captain)
  select v_user, v_gw, s, true, null, s = p_captain, s = p_vice_captain
  from unnest(p_starters) as s
  union all
  select v_user, v_gw, b.pid, false, b.ord::int, false, false
  from unnest(p_bench) with ordinality as b(pid, ord);

  return json_build_object(
    'gameweek_id', v_gw,
    'cost',        v_cost,
    'transfers',   v_transfers
  );
end;
$$;


-- Only logged-in students can call these
revoke execute on function public.save_team(int[], int[], int, int) from public, anon;
grant  execute on function public.save_team(int[], int[], int, int) to authenticated;
revoke execute on function public.get_team_state() from public, anon;
grant  execute on function public.get_team_state() to authenticated;