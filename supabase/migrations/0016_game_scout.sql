-- Súmula do jogo: placar e scout completo por atleta (gols, assistências,
-- cartões, faltas, lesões e pênaltis), no mesmo padrão de RLS de `games`.
alter table games add column our_score int;
alter table games add column opponent_score int;

create table game_events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  game_id uuid not null references games(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete cascade,
  event_type text not null check (event_type in (
    'Gol',
    'Assistência',
    'Falta',
    'Cartão amarelo',
    'Cartão vermelho',
    'Lesão',
    'Pênalti sofrido',
    'Pênalti perdido',
    'Pênalti defendido'
  )),
  goal_type text check (goal_type in ('Normal', 'Pênalti', 'Cabeça', 'Contra', 'Fora da área')),
  minute int,
  notes text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create index on game_events (club_id);
create index on game_events (game_id);
create index on game_events (athlete_id);
alter table game_events enable row level security;

create policy "coach manages game_events" on game_events for all
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');

create policy "athlete reads own game_events" on game_events for select
  using (athlete_id = (select athlete_id from my_profile()));
