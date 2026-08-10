-- Snapshot do card FIFA a cada vez que muda, pra detectar subida/queda de
-- score e mostrar um alerta na aplicação do atleta (e na ficha, pro
-- treinador). Cada linha nova só é gravada quando o overall muda —
-- vira o "antes" da próxima comparação.
create table athlete_score_snapshots (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete cascade,
  overall int not null,
  attack int not null,
  defense int not null,
  discipline int not null,
  physical int not null,
  mental int not null,
  commitment int not null,
  development int not null,
  computed_at timestamptz not null default now()
);

create index on athlete_score_snapshots (athlete_id, computed_at desc);

alter table athlete_score_snapshots enable row level security;

create policy "coach reads score snapshots" on athlete_score_snapshots for select
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');

create policy "athlete reads own score snapshots" on athlete_score_snapshots for select
  using (
    athlete_id = (select athlete_id from my_profile())
    and (select role from my_profile()) = 'athlete'
  );

-- Escrita feita pela mesma rota que lê o score (coach ou o próprio atleta),
-- então libera insert pros dois papéis com o mesmo escopo do select.
create policy "coach writes score snapshots" on athlete_score_snapshots for insert
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');

create policy "athlete writes own score snapshots" on athlete_score_snapshots for insert
  with check (
    athlete_id = (select athlete_id from my_profile())
    and (select role from my_profile()) = 'athlete'
  );
