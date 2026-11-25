-- =====================================================================
--  PAU Fantasy — database schema (Step 2B)
--  Coupe de Escrivá · Basketball
--  Run this ONCE in Supabase → SQL Editor on a fresh project.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------------------

-- The four houses
create table public.houses (
  id          serial primary key,
  name        text not null unique,
  short_name  text not null unique,
  color       text not null
);

-- Real basketball players (10 per house)
create table public.players (
  id             serial primary key,
  name           text not null,
  house_id       int  not null references public.houses(id),
  position       text check (position in ('Guard', 'Forward', 'Center')),
  jersey_number  int,
  price          numeric(4,1) not null default 9.0 check (price > 0),  -- in-game coins
  active         boolean not null default true
);

-- Weekly rounds. Teams lock at the deadline.
create table public.gameweeks (
  id           serial primary key,
  name         text not null,
  deadline     timestamptz not null,
  is_finished  boolean not null default false
);

-- Games between houses
create table public.fixtures (
  id             serial primary key,
  gameweek_id    int not null references public.gameweeks(id),
  home_house_id  int not null references public.houses(id),
  away_house_id  int not null references public.houses(id),
  tip_off        timestamptz,
  venue          text,
  home_score     int,
  away_score     int,
  status         text not null default 'scheduled'
                 check (status in ('scheduled', 'live', 'finished')),
  check (home_house_id <> away_house_id)
);

-- Secret QR check-in codes (kept separate so students can't read them)
create table public.fixture_checkin_codes (
  fixture_id  int primary key references public.fixtures(id) on delete cascade,
  code        text not null default substr(md5(random()::text), 1, 8)
);

-- Each player's stats in each game (entered by an admin)
create table public.player_stats (
  id          serial primary key,
  fixture_id  int not null references public.fixtures(id) on delete cascade,
  player_id   int not null references public.players(id),
  points      int not null default 0 check (points   >= 0),
  rebounds    int not null default 0 check (rebounds >= 0),
  assists     int not null default 0 check (assists  >= 0),
  steals      int not null default 0 check (steals   >= 0),
  blocks      int not null default 0 check (blocks   >= 0),
  unique (fixture_id, player_id)
);

-- One profile per student account
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null,
  team_name     text,
  is_admin      boolean not null default false,
  created_at    timestamptz not null default now()
);

-- A student's 10-player squad for a given gameweek
-- (5 starters + 5 subs, ordered 1-5 on the bench;
--  captain and vice-captain must both be starters)
create table public.picks (
  id                serial primary key,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  gameweek_id       int  not null references public.gameweeks(id),
  player_id         int  not null references public.players(id),
  is_captain        boolean not null default false,
  is_vice_captain   boolean not null default false,
  is_starter   boolean not null default true,
  bench_order  int check (bench_order between 1 and 5),
  unique (user_id, gameweek_id, player_id)
);

-- Who showed up to which game (QR check-in = +5 points)
create table public.attendance (
  id             serial primary key,
  user_id        uuid not null references public.profiles(id) on delete cascade,
  fixture_id     int  not null references public.fixtures(id) on delete cascade,
  checked_in_at  timestamptz not null default now(),
  unique (user_id, fixture_id)
);


-- ---------------------------------------------------------------------
-- 2. HELPERS
-- ---------------------------------------------------------------------

-- Is the logged-in user an admin?
create function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Automatically create a profile when someone signs up
create function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------------------------------------------------------------------
-- 3. SECURITY (Row Level Security)
-- ---------------------------------------------------------------------

-- League data: everyone can read, only admins can change
do $$
declare t text;
begin
  foreach t in array array['houses', 'players', 'gameweeks', 'fixtures', 'player_stats'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "Anyone can read" on public.%I for select to anon, authenticated using (true)', t);
    execute format(
      'create policy "Admins can write" on public.%I for all to authenticated
         using ((select public.is_admin())) with check ((select public.is_admin()))', t);
  end loop;
end $$;

-- QR codes: admins only
alter table public.fixture_checkin_codes enable row level security;
create policy "Admins only" on public.fixture_checkin_codes
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Profiles: everyone can see names (for the leaderboard), you can edit only your own
alter table public.profiles enable row level security;
create policy "Anyone can read profiles" on public.profiles
  for select to anon, authenticated using (true);
create policy "Edit own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Picks & attendance: readable by all; writes go through server functions (Steps 3 & 5)
alter table public.picks enable row level security;
create policy "Anyone can read picks" on public.picks
  for select to anon, authenticated using (true);

alter table public.attendance enable row level security;
create policy "Read own attendance" on public.attendance
  for select to authenticated using (user_id = (select auth.uid()));


-- ---------------------------------------------------------------------
-- 4. PERMISSIONS
-- ---------------------------------------------------------------------

grant select on all tables in schema public to anon, authenticated;
grant insert, update, delete
  on public.houses, public.players, public.gameweeks, public.fixtures,
     public.player_stats, public.fixture_checkin_codes
  to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Students can change their name/team name, but NEVER make themselves admin
revoke update on public.profiles from anon, authenticated;
grant update (display_name, team_name) on public.profiles to authenticated;


-- ---------------------------------------------------------------------
-- 5. SEED DATA (placeholders — real names come later)
-- ---------------------------------------------------------------------

insert into public.houses (name, short_name, color) values
  ('Madiba',    'MAD', '#111111'),
  ('TSG',       'TSG', '#DC2626'),
  ('Cirok',     'CIR', '#FFFFFF'),
  ('Blue Jays', 'BJ',  '#1D4ED8');

-- 10 placeholder players per house, prices between 7.0 and 12.0
insert into public.players (name, house_id, position, jersey_number, price)
select
  h.short_name || ' Player ' || n,
  h.id,
  (array['Guard', 'Guard', 'Forward', 'Forward', 'Center'])[1 + (n - 1) % 5],
  n,
  round((7 + random() * 5)::numeric, 1)
from public.houses h
cross join generate_series(1, 10) as n;

insert into public.gameweeks (name, deadline) values
  ('Gameweek 1', '2026-12-05 16:00+01'),
  ('Gameweek 2', '2026-12-12 16:00+01'),
  ('Gameweek 3', '2026-12-19 16:00+01');

-- Round robin: every house plays every other house once
insert into public.fixtures (gameweek_id, home_house_id, away_house_id)
select
  gw.id,
  (select id from public.houses where short_name = v.home),
  (select id from public.houses where short_name = v.away)
from (values
  ('Gameweek 1', 'MAD', 'TSG'), ('Gameweek 1', 'CIR', 'BJ'),
  ('Gameweek 2', 'MAD', 'CIR'), ('Gameweek 2', 'TSG', 'BJ'),
  ('Gameweek 3', 'MAD', 'BJ'),  ('Gameweek 3', 'TSG', 'CIR')
) as v(gw_name, home, away)
join public.gameweeks gw on gw.name = v.gw_name;

-- One secret check-in code per fixture
insert into public.fixture_checkin_codes (fixture_id)
select id from public.fixtures;