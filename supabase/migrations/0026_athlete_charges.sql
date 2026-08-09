-- Aba financeira por atleta: lançamentos de mensalidade (competência,
-- vencimento, status). Sem coleta de cartão aqui — isso depende de uma
-- conta real num gateway de pagamento (ver nota no lib/actions/billing.ts).
create table athlete_charges (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete cascade,
  description text not null,
  amount_cents int not null check (amount_cents > 0),
  competence_month int not null check (competence_month between 1 and 12),
  competence_year int not null,
  due_date date not null,
  status text not null default 'Pendente' check (status in ('Pendente', 'Pago', 'Atrasado', 'Cancelado')),
  paid_at timestamptz,
  payment_method text,
  notes text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create index on athlete_charges (athlete_id);
create index on athlete_charges (club_id);
alter table athlete_charges enable row level security;

create policy "coach manages charges" on athlete_charges for all
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');

create policy "athlete reads own charges" on athlete_charges for select
  using (athlete_id = (select athlete_id from my_profile()));

create policy "staff reads granted charges" on athlete_charges for select
  using (has_athlete_access(athlete_id));
