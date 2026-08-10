-- Aba de Lesões: registro pode vir de um evento "Lesão" já lançado na
-- súmula de um jogo (source_game_event_id) ou ser um lançamento avulso
-- (ex.: lesão em treino, sem jogo associado). Severidade usa a mesma lógica
-- clínica leiga dos graus 1/2/3 de lesão muscular (padrão consolidado em
-- medicina esportiva pra estiramentos, sem depender de exame de imagem —
-- adequado pra uma escolinha de base sem acesso rotineiro a ressonância),
-- generalizada aqui pra cobrir qualquer tipo de lesão, não só muscular.
-- Terreno pronto pra futura aba de fisioterapia: treatment_notes e
-- expected_return_date já guardam o acompanhamento do prazo de recuperação.
create table athlete_injuries (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete cascade,
  source text not null check (source in ('Jogo', 'Avulso')),
  game_id uuid references games(id) on delete set null,
  source_game_event_id uuid references game_events(id) on delete set null,
  body_region text not null,
  injury_type text not null,
  severity text not null check (severity in ('Leve (grau 1)', 'Moderada (grau 2)', 'Grave (grau 3)')),
  description text,
  occurred_at date not null default current_date,
  expected_return_date date,
  status text not null default 'Em tratamento' check (status in ('Em tratamento', 'Em observação', 'Recuperado')),
  treatment_notes text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on athlete_injuries (club_id, athlete_id);
create index on athlete_injuries (game_id);

alter table athlete_injuries enable row level security;

create policy "coach manages injuries" on athlete_injuries for all
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');

create policy "athlete reads own injuries" on athlete_injuries for select
  using (
    athlete_id = (select athlete_id from my_profile())
    and (select role from my_profile()) = 'athlete'
  );
