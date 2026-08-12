-- A trilha nasceu só pro financeiro, mas as perguntas que aparecem na
-- operação real são mais amplas: quem tirou o atleta da convocação, quem
-- desativou o cadastro, quem deu acesso a esse profissional, quem apagou
-- o registro de lesão. Tudo isso mexe com a vida de uma pessoa e hoje
-- some sem deixar rastro.
--
-- Uma trilha só, e não uma segunda tabela: a pergunta do treinador é
-- "o que aconteceu com esse atleta", que atravessa dinheiro, escalação e
-- saúde. Duas tabelas obrigariam a costurar as duas em toda consulta.
alter table financial_audit_log rename to audit_log;

alter table audit_log drop constraint financial_audit_log_entity_type_check;
alter table audit_log add constraint audit_log_entity_type_check check (
  entity_type in (
    'charge', 'expense', 'cash_closure',
    'athlete', 'lineup', 'injury', 'access', 'challenge'
  )
);

alter table audit_log drop constraint financial_audit_log_action_check;
alter table audit_log add constraint audit_log_action_check check (
  action in (
    'status_change', 'due_date_change', 'edit', 'delete', 'reopen',
    'create', 'deactivate', 'reactivate', 'transfer',
    'publish', 'unpublish', 'grant', 'revoke', 'review'
  )
);

-- Trilha não pode ser refém de quem a escreveu: com a FK barrando, apagar
-- a conta de um ex-funcionário ficava impossível sem destruir o histórico
-- dele. performed_by_name já guarda quem foi, então soltar o vínculo não
-- perde informação.
alter table audit_log alter column performed_by drop not null;
alter table audit_log drop constraint financial_audit_log_performed_by_fkey;
alter table audit_log
  add constraint audit_log_performed_by_fkey
  foreign key (performed_by) references profiles(id) on delete set null;

-- O atleta afetado, quando existe. Sem isso, mostrar a trilha dentro da
-- ficha exigiria decodificar entity_id de um jeito diferente por tipo.
alter table audit_log add column athlete_id uuid references athletes(id) on delete cascade;
create index on audit_log (athlete_id, performed_at desc);

alter policy "coach reads financial audit log" on audit_log rename to "coach reads audit log";
alter policy "coach writes financial audit log" on audit_log rename to "coach writes audit log";
