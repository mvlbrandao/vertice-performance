-- Desativação de atleta (fim de vínculo/contrato), pra sair da lista ativa
-- sem perder o histórico, e alimentar o KPI de churn.
alter table athletes add column is_active boolean not null default true;
alter table athletes add column deactivated_at timestamptz;
alter table athletes add column deactivation_reason text;

create index on athletes (club_id, is_active);
