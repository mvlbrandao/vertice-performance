-- Lançamentos avulsos de caixa: entradas/saídas do dia que não vêm de
-- athlete_charges nem expenses (ex.: venda de uniforme avulsa, retirada
-- pra troco). Entram na conta do caixa do dia junto com os outros dois.
create table cash_movements (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  movement_date date not null,
  type text not null check (type in ('entrada', 'saida')),
  description text not null,
  amount_cents int not null check (amount_cents > 0),
  created_by uuid not null references profiles(id),
  created_by_name text not null,
  created_at timestamptz not null default now()
);

create index on cash_movements (club_id, movement_date);

alter table cash_movements enable row level security;
create policy "coach manages cash movements" on cash_movements for all
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');
