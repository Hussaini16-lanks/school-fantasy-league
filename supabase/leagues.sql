-- =====================================================================
--  PAU Fantasy — private leagues (Step 6B)
--  Run ONCE in Supabase → SQL Editor (new query).
-- =====================================================================

create table public.leagues (
  id          serial primary key,
  name        text not null check (char_length(name) between 3 and 40),
  code        text not null unique default upper(substr(md5(random()::text), 1, 6)),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table public.league_members (
  league_id  int  not null references public.leagues(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (league_id, user_id)
);

-- Locked down: everything goes through the functions below
alter table public.leagues        enable row level security;
alter table public.league_members enable row level security;


-- Create a league (you join it automatically)
create or replace function public.create_league(p_name text)
returns json
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id    int;
  v_code  text;
  v_owned int;
begin
  if auth.uid() is null then
    raise exception 'Log in first';
  end if;
  if char_length(trim(coalesce(p_name, ''))) < 3 then
    raise exception 'League name must be at least 3 characters';
  end if;

  select count(*) into v_owned from public.leagues where owner_id = auth.uid();
  if v_owned >= 5 then
    raise exception 'You can create up to 5 leagues';
  end if;

  insert into public.leagues (name, owner_id)
  values (trim(p_name), auth.uid())
  returning id, code into v_id, v_code;

  insert into public.league_members (league_id, user_id) values (v_id, auth.uid());

  return json_build_object('id', v_id, 'code', v_code);
end;
$$;


-- Join a league with its code
create or replace function public.join_league(p_code text)
returns json
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id   int;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'Log in first';
  end if;

  select l.id, l.name into v_id, v_name
  from public.leagues l
  where l.code = upper(trim(coalesce(p_code, '')));

  if not found then
    raise exception 'No league found with that code';
  end if;

  insert into public.league_members (league_id, user_id)
  values (v_id, auth.uid())
  on conflict do nothing;

  return json_build_object('id', v_id, 'name', v_name);
end;
$$;


-- Leave a league (if the owner leaves, the league is deleted)
create or replace function public.leave_league(p_league_id int)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.leagues where id = p_league_id and owner_id = auth.uid()) then
    delete from public.leagues where id = p_league_id;
  else
    delete from public.league_members where league_id = p_league_id and user_id = auth.uid();
  end if;
end;
$$;


-- Standings for one league (members only)
create or replace function public.league_standings(p_league_id int)
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
  with lb as (
    select * from public.leaderboard()
  )
  select rank() over (order by coalesce(lb.total_points, 0) desc),
         pr.id,
         pr.display_name,
         pr.team_name,
         coalesce(lb.gw_points, 0),
         coalesce(lb.total_points, 0)::bigint
  from public.league_members m
  join public.profiles pr on pr.id = m.user_id
  left join lb on lb.user_id = m.user_id
  where m.league_id = p_league_id
    and exists (
      select 1 from public.league_members me
      where me.league_id = p_league_id and me.user_id = auth.uid()
    )
  order by coalesce(lb.total_points, 0) desc, pr.display_name;
$$;


-- The leagues I'm in, with member count and my rank
create or replace function public.my_leagues()
returns table (
  id        int,
  name      text,
  code      text,
  is_owner  boolean,
  members   bigint,
  my_rank   bigint
)
language sql stable security definer
set search_path = ''
as $$
  select l.id,
         l.name,
         l.code,
         (l.owner_id = auth.uid()),
         (select count(*) from public.league_members m2 where m2.league_id = l.id),
         (select s.rank from public.league_standings(l.id) s where s.user_id = auth.uid())
  from public.leagues l
  join public.league_members m on m.league_id = l.id and m.user_id = auth.uid()
  order by l.created_at;
$$;


-- Only logged-in users
revoke execute on function public.create_league(text)    from public, anon;
revoke execute on function public.join_league(text)      from public, anon;
revoke execute on function public.leave_league(int)      from public, anon;
revoke execute on function public.league_standings(int)  from public, anon;
revoke execute on function public.my_leagues()           from public, anon;
grant  execute on function public.create_league(text)    to authenticated;
grant  execute on function public.join_league(text)      to authenticated;
grant  execute on function public.leave_league(int)      to authenticated;
grant  execute on function public.league_standings(int)  to authenticated;
grant  execute on function public.my_leagues()           to authenticated;