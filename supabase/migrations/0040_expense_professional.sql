-- Vincula despesa a um profissional (obrigatório pra Salários e comissão
-- técnica), e protege essa categoria específica contra exclusão — ela
-- alimenta a aba de recebimentos no cadastro do profissional, então
-- apagá-la quebraria a consistência do histórico financeiro dele.
alter table expense_categories add column requires_professional boolean not null default false;
alter table expense_categories add column is_locked boolean not null default false;

update expense_categories
set requires_professional = true, is_locked = true
where name = 'Salários e comissão técnica';

alter table expenses add column professional_id uuid references profiles(id) on delete set null;
create index on expenses (professional_id);
