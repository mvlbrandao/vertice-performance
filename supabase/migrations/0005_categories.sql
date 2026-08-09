-- Cadastro estruturado de categorias/subs (ex: Sub-9, Sub-11, Sub-13) do clube,
-- pra padronizar o que hoje é digitado como texto livre no cadastro de atleta.
create table categories (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (club_id, name)
);

create index on categories (club_id);

alter table categories enable row level security;

create policy "coach manages categories" on categories for all
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');

create policy "club members read categories" on categories for select
  using (club_id = (select club_id from my_profile()));
