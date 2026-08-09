-- Trilha de auditoria de alterações e baixas em contas a pagar (expenses) e
-- contas a receber (athlete_charges). Registrado nas server actions, não em
-- trigger, pra guardar quem foi (created_by) sem depender de contexto de
-- sessão dentro do banco.
create table financial_audit_log (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  entity_type text not null check (entity_type in ('charge', 'expense')),
  entity_id uuid not null,
  action text not null check (action in ('status_change', 'due_date_change', 'edit', 'delete')),
  details jsonb not null default '{}'::jsonb,
  performed_by uuid not null references profiles(id),
  performed_by_name text not null,
  performed_at timestamptz not null default now()
);

create index on financial_audit_log (club_id, performed_at desc);
create index on financial_audit_log (entity_type, entity_id);

alter table financial_audit_log enable row level security;
create policy "coach reads financial audit log" on financial_audit_log for select
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');
create policy "coach writes financial audit log" on financial_audit_log for insert
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');
