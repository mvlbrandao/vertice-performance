-- Reabertura de caixa de dias já virados passa a exigir motivo e fica
-- registrada na auditoria financeira (mesma tabela usada pra
-- alteração/baixa de contas a pagar e a receber).
alter table financial_audit_log drop constraint financial_audit_log_entity_type_check;
alter table financial_audit_log add constraint financial_audit_log_entity_type_check
  check (entity_type in ('charge', 'expense', 'cash_closure'));

alter table financial_audit_log drop constraint financial_audit_log_action_check;
alter table financial_audit_log add constraint financial_audit_log_action_check
  check (action in ('status_change', 'due_date_change', 'edit', 'delete', 'reopen'));
