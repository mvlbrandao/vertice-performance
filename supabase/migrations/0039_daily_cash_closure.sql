-- Caixa do dia: fechamento diário que "sela" um snapshot de
-- entradas/saídas do dia (a partir de athlete_charges e expenses já
-- pagos), pra um funcionário conferir e fechar o caixa no fim do dia.
create table daily_cash_closures (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  closure_date date not null,
  income_cents int not null,
  expense_cents int not null,
  balance_cents int not null,
  income_count int not null,
  expense_count int not null,
  notes text,
  closed_by uuid not null references profiles(id),
  closed_by_name text not null,
  closed_at timestamptz not null default now(),
  unique (club_id, closure_date)
);

alter table daily_cash_closures enable row level security;
create policy "coach manages daily cash closures" on daily_cash_closures for all
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');
