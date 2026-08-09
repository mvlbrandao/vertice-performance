-- Contas a pagar: despesas do clube, com categoria (plano de contas simples).
-- Espelha o padrão de athlete_charges (status Pendente/Pago/Atrasado/
-- Cancelado, due_date + paid_at) pra reaproveitar a mesma lógica de
-- inadimplência/baixa já usada no financeiro do atleta.
create table expense_categories (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (club_id, name)
);

alter table expense_categories enable row level security;
create policy "coach manages expense categories" on expense_categories for all
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');

create table expenses (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  category_id uuid references expense_categories(id) on delete set null,
  description text not null,
  amount_cents int not null check (amount_cents > 0),
  due_date date not null,
  status text not null default 'Pendente' check (status in ('Pendente', 'Pago', 'Atrasado', 'Cancelado')),
  paid_at timestamptz,
  payment_method text,
  notes text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create index on expenses (club_id, due_date);
create index on expenses (category_id);
alter table expenses enable row level security;
create policy "coach manages expenses" on expenses for all
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');

-- Categorias comuns pra clube/escolinha de base, já cadastradas pra cada
-- clube existente (pesquisa: aluguel de campo costuma ser o maior custo
-- mensal de uma escolinha, seguido de material esportivo e salários).
insert into expense_categories (club_id, name)
select c.id, cat.name
from clubs c
cross join (values
  ('Aluguel de campo/quadra'),
  ('Material esportivo'),
  ('Uniformes'),
  ('Salários e comissão técnica'),
  ('Transporte / viagens'),
  ('Alimentação'),
  ('Taxas de inscrição em competições'),
  ('Arbitragem'),
  ('Manutenção de equipamentos'),
  ('Marketing e divulgação'),
  ('Taxas administrativas e bancárias'),
  ('Fisioterapia e saúde'),
  ('Outros')
) as cat(name);
