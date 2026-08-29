-- LGPD de verdade: export e exclusão (anonimização) deixam de ser um
-- ticket manual e passam a ter execução real, mas sempre com confirmação
-- humana do treinador antes de rodar (ver lib/actions/dataRequests.ts) —
-- nada roda sozinho por cron.

alter table data_requests add column resolved_by uuid references profiles(id);
alter table data_requests add column export_path text;
alter table data_requests add column error_message text;

alter table data_requests drop constraint data_requests_status_check;
alter table data_requests add constraint data_requests_status_check
  check (status in ('Pendente', 'Em andamento', 'Concluído', 'Falhou'));

alter table audit_log drop constraint audit_log_action_check;
alter table audit_log add constraint audit_log_action_check check (
  action in (
    'status_change', 'due_date_change', 'edit', 'delete', 'reopen',
    'create', 'deactivate', 'reactivate', 'transfer',
    'publish', 'unpublish', 'grant', 'revoke', 'review',
    'anonymize', 'export'
  )
);

-- Bucket privado pro JSON de exportação. Sem policy de storage.objects de
-- propósito: quem assina o link é sempre o client de serviço, dentro de uma
-- action que já checou requireAthlete/requireCoach — a policy de RLS do
-- bucket seria redundante (e mais frágil, porque coach e o próprio atleta
-- precisam ler o mesmo arquivo).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('data-exports', 'data-exports', false, 20971520, array['application/json']);
