-- Reformula pra estrutura pedida: um diretório de clubes (o "Time" do
-- atleta é qual clube desses ele joga), e cada clube tem seus próprios
-- subs (categorias) aninhados dentro. Substitui os cadastros soltos de
-- `teams` (renomeada) e `categories` (removida).

alter table teams rename to partner_clubs;

create table partner_club_categories (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  partner_club_id uuid not null references partner_clubs(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (partner_club_id, name)
);

create index on partner_club_categories (partner_club_id);
create index on partner_club_categories (club_id);

alter table partner_club_categories enable row level security;

create policy "coach manages partner_club_categories" on partner_club_categories for all
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');

create policy "club members read partner_club_categories" on partner_club_categories for select
  using (club_id = (select club_id from my_profile()));

drop policy "coach manages categories" on categories;
drop policy "club members read categories" on categories;
drop table categories;
