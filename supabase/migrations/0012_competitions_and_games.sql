-- Calendário de jogos por competição. Mesmo padrão de alvo (atleta ou
-- time) já usado em `plays`.
create table competitions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create index on competitions (club_id);
alter table competitions enable row level security;

create policy "coach manages competitions" on competitions for all
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');

create policy "club members read competitions" on competitions for select
  using (club_id = (select club_id from my_profile()));

create table games (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  competition_id uuid not null references competitions(id) on delete cascade,
  created_by uuid not null references profiles(id),
  opponent text not null,
  scheduled_date date not null,
  scheduled_time time,
  location text,
  target_type text not null check (target_type in ('athlete', 'team')),
  target_athlete_id uuid references athletes(id) on delete cascade,
  target_team text,
  notes text,
  created_at timestamptz not null default now()
);

create index on games (club_id);
create index on games (competition_id);
create index on games (target_athlete_id);
alter table games enable row level security;

create policy "coach manages games" on games for all
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');

create policy "athlete reads own or team games" on games for select
  using (
    club_id = (select club_id from my_profile())
    and (
      target_athlete_id = (select athlete_id from my_profile())
      or target_team in (select team from athletes where id = (select athlete_id from my_profile()))
    )
  );
