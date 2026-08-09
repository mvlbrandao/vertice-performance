-- Histórico de transferência de clube do atleta, auditável e exibido
-- na linha do tempo.
create table athlete_club_transfers (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  club_id uuid not null references clubs(id) on delete cascade,
  from_partner_club_id uuid references partner_clubs(id) on delete set null,
  from_category text,
  to_partner_club_id uuid not null references partner_clubs(id),
  to_category text,
  transferred_at date not null default current_date,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create index on athlete_club_transfers (athlete_id);
create index on athlete_club_transfers (club_id);
alter table athlete_club_transfers enable row level security;

create policy "coach manages athlete_club_transfers" on athlete_club_transfers for all
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');

create policy "athlete reads own athlete_club_transfers" on athlete_club_transfers for select
  using (athlete_id = (select athlete_id from my_profile()));
