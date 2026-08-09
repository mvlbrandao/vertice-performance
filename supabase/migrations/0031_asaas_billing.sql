-- Integração de cobrança recorrente via Asaas (cartão/PIX/boleto). Guarda só
-- o necessário pra criar/rastrear cliente e assinatura no Asaas — nenhum
-- dado de cartão passa por aqui, isso fica inteiramente no checkout
-- hospedado do Asaas.
alter table athletes add column guardian_cpf text;
alter table athletes add column guardian_email text;
alter table athletes add column asaas_customer_id text;

alter table athlete_charges add column asaas_payment_id text;
alter table athlete_charges add column asaas_subscription_id text;
create unique index athlete_charges_asaas_payment_id_key on athlete_charges (asaas_payment_id)
  where asaas_payment_id is not null;

create table athlete_billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete cascade,
  asaas_subscription_id text not null unique,
  billing_type text not null check (billing_type in ('CREDIT_CARD', 'PIX', 'BOLETO', 'UNDEFINED')),
  amount_cents int not null check (amount_cents > 0),
  cycle text not null default 'MONTHLY',
  description text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  checkout_url text,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create index on athlete_billing_subscriptions (athlete_id);
alter table athlete_billing_subscriptions enable row level security;

create policy "coach manages billing subscriptions" on athlete_billing_subscriptions for all
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');

create policy "athlete reads own billing subscription" on athlete_billing_subscriptions for select
  using (athlete_id = (select athlete_id from my_profile()));
