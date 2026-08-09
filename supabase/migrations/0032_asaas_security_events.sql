-- Auditoria do mecanismo de segurança "Validação de saque via Webhook" do
-- Asaas. Este app nunca inicia saque/transferência/pagamento de conta/
-- recarga via API — qualquer chamada nesse endpoint é, por definição, algo
-- que o app não fez por conta própria, então a decisão é sempre recusar.
-- Esta tabela só registra pra dar visibilidade caso isso aconteça de verdade
-- (ex.: chave de API vazada e alguém tentando sacar).
create table asaas_security_events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  event_type text not null,
  payload jsonb not null,
  decision text not null default 'REFUSED',
  created_at timestamptz not null default now()
);

create index on asaas_security_events (club_id, created_at desc);
alter table asaas_security_events enable row level security;

create policy "coach reads own security events" on asaas_security_events for select
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');
