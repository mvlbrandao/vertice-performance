-- Trilha das ações do administrador da plataforma (nós), separada do
-- audit_log dos clubes.
--
-- São duas perguntas diferentes. O audit_log responde ao treinador "o que
-- aconteceu com esse atleta no meu clube". Esta responde a nós "quem mexeu
-- no preço, na cortesia ou no bloqueio de qual clube, e quando". Misturar
-- as duas obrigaria a expor ação de plataforma na tela de um clube.
--
-- Sem FK para clubs de propósito: o expurgo de clube cancelado apaga a linha
-- do clube, e a trilha precisa sobreviver a isso — por isso também guarda
-- o nome do clube como retrato (target_club_name). Pelo mesmo motivo
-- actor_user_id não referencia auth.users.
--
-- Somente acrescenta: trigger bloqueia UPDATE e DELETE. A service role
-- ignora RLS, mas não ignora trigger — então nem um bug no painel consegue
-- reescrever o histórico.
create table platform_audit_log (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_user_id uuid,
  actor_email text not null,
  -- "<entidade>.<verbo>", ex.: club.extend_trial, contract.create
  action text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),
  target_club_id uuid,
  target_club_name text,
  details jsonb not null default '{}'::jsonb,
  ip text
);

create index platform_audit_log_occurred_idx on platform_audit_log (occurred_at desc);
create index platform_audit_log_club_idx on platform_audit_log (target_club_id, occurred_at desc)
  where target_club_id is not null;

-- Só a plataforma lê e escreve, via service role. Nenhum clube enxerga isto.
alter table platform_audit_log enable row level security;
revoke all on platform_audit_log from anon, authenticated;

create function public.platform_audit_log_immutable() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'platform_audit_log é somente de acréscimo (% bloqueado)', tg_op;
end;
$$;

-- Função de gatilho: ninguém precisa de EXECUTE (mesma regra da 0050).
revoke execute on function public.platform_audit_log_immutable() from public, anon, authenticated;

create trigger platform_audit_log_append_only
  before update or delete on platform_audit_log
  for each row execute function public.platform_audit_log_immutable();
