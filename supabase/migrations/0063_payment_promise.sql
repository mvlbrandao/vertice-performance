-- Promessa de pagamento: liberação única e automática pro próprio treinador
-- usar quando o clube está bloqueado, sem precisar esperar o suporte. Guarda
-- quando foi usada pra impedir um segundo uso — vira cortesia de verdade
-- (courtesy_until) por dentro, só com um motivo fixo que identifica a origem.
alter table clubs add column payment_promise_used_at timestamptz;

comment on column clubs.payment_promise_used_at is
  'Quando o clube usou a liberação automática de 48h por promessa de pagamento. Uma vez só.';
