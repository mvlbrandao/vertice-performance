-- Cobrança real do clube pela plataforma (nós cobrando o clube), em cima
-- das colunas que já existiam pra isso desde o ciclo de vida do clube
-- (clubs.asaas_customer_id/asaas_subscription_id) mas nunca foram usadas.
--
-- Conta Asaas envolvida é a NOSSA (lib/asaas/platform.ts), não a de cada
-- clube (club_asaas_credentials) — não confundir os dois sentidos de
-- dinheiro, mesmo alerta que já existe na migração 0055.

-- Asaas exige cpfCnpj pra criar cliente. Não existe em clubs nem em
-- profiles hoje — só em athletes.guardian_cpf, que é outro fluxo.
alter table clubs add column billing_cpf_cnpj text;

-- Marcado uma única vez, na primeira confirmação de pagamento. Sem isso
-- não dá pra medir tempo até conversão nem taxa de conversão por período —
-- status sozinho não diz quando a virada aconteceu.
alter table clubs add column converted_at timestamptz;

-- Link de checkout da assinatura, pra você copiar e mandar pro cliente.
-- Mesmo papel de athlete_billing_subscriptions.checkout_url, só que aqui
-- cabe direto em clubs porque um clube tem no máximo uma assinatura
-- nossa ativa por vez (diferente de atleta, que pode ter mais de uma
-- cobrança recorrente configurada).
alter table clubs add column asaas_checkout_url text;

-- Ledger de cobrança do clube, espelhando athlete_charges um nível acima.
create table platform_charges (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  description text not null,
  amount_cents int not null check (amount_cents > 0),
  due_date date not null,
  status text not null default 'Pendente' check (status in ('Pendente', 'Pago', 'Atrasado', 'Cancelado')),
  paid_at timestamptz,
  asaas_payment_id text,
  asaas_subscription_id text,
  created_at timestamptz not null default now()
);

create unique index platform_charges_asaas_payment_id_key on platform_charges (asaas_payment_id)
  where asaas_payment_id is not null;
create index on platform_charges (club_id);

-- RLS ligado e sem nenhuma policy: não é dado de nenhum papel dentro do
-- clube, é dado nosso sobre o clube. Só o admin client (service role) lê,
-- mesmo padrão de club_asaas_credentials (migração 0056).
alter table platform_charges enable row level security;
