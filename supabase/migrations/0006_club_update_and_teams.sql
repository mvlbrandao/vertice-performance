-- Permite ao treinador renomear o próprio clube (antes só havia leitura).
create policy "coach updates own club" on clubs for update
  using (id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');

-- Cadastro estruturado de times/turmas do clube (ex: Sub-12 A, Sub-12 B),
-- mesmo padrão de `categories`, pra tirar o campo "Time" do atleta do texto livre.
create table teams (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (club_id, name)
);

create index on teams (club_id);

alter table teams enable row level security;

create policy "coach manages teams" on teams for all
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');

create policy "club members read teams" on teams for select
  using (club_id = (select club_id from my_profile()));
