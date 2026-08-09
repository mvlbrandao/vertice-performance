-- Escalação de partida: antes de lançar a súmula, o treinador define o time
-- titular/reservas, anexa uma jogada da mesa tática e/ou vídeo pra repassar
-- aos convocados, e pode deixar uma instrução individual por atleta. Ao
-- publicar (lineup_published_at preenchido), os atletas escalados passam a
-- enxergar a convocação — esse é o "alerta".
alter table games add column lineup_play_id uuid references plays(id) on delete set null;
alter table games add column lineup_video_url text;
alter table games add column lineup_published_at timestamptz;

create table game_lineups (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  game_id uuid not null references games(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete cascade,
  status text not null default 'Convocado' check (status in ('Titular', 'Reserva', 'Convocado')),
  notes text,
  created_at timestamptz not null default now(),
  unique (game_id, athlete_id)
);

create index on game_lineups (game_id);
create index on game_lineups (athlete_id);
alter table game_lineups enable row level security;

create policy "coach manages game lineups" on game_lineups for all
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');

-- Atleta só vê a própria linha, e só depois que o treinador publicou a
-- escalação (games.lineup_published_at preenchido) — antes disso é rascunho.
create policy "athlete reads own published lineup" on game_lineups for select
  using (
    athlete_id = (select athlete_id from my_profile())
    and exists (
      select 1 from games g
      where g.id = game_lineups.game_id
        and g.lineup_published_at is not null
    )
  );
