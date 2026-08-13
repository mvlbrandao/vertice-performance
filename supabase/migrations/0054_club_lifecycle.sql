-- Ciclo de vida do clube: o que transforma um banco multi-inquilino numa
-- operação de SaaS. Até aqui `clubs` só tinha nome e cota — não havia como
-- responder "esse clube está em teste, pagando ou vencido?".
--
-- Base dos próximos passos: cadastro público (precisa criar em 'trial'),
-- bloqueio no fim do teste (precisa de status e prazo), painel de
-- administração (precisa ver os dois) e link próprio por cliente (slug).

-- Slug: o identificador que aparece na URL (/c/vertice-performance). Fica
-- separado do nome porque o clube pode se renomear sem quebrar links já
-- distribuídos, e porque nome aceita acento e espaço, que URL não quer.
alter table clubs add column slug text;

-- Estados possíveis, e o que cada um significa na prática:
--   trial     — testando, acesso completo até trial_ends_at
--   ativo     — assinatura em dia
--   atrasado  — cobrança falhou; ainda entra, mas vê o aviso
--   bloqueado — sem acesso, só a tela de assinatura
--   cancelado — encerrado; conta-se o prazo de retenção antes de apagar
alter table clubs add column status text not null default 'trial'
  check (status in ('trial', 'ativo', 'atrasado', 'bloqueado', 'cancelado'));

alter table clubs add column trial_ends_at timestamptz;
alter table clubs add column plan text;

-- Quem responde pelo clube: é para essa pessoa que a tela de pagamento
-- aparece, e é dela a assinatura. on delete set null porque perder o dono
-- não pode arrastar o clube e os atletas junto.
alter table clubs add column owner_profile_id uuid references profiles(id) on delete set null;

-- Assinatura do clube na NOSSA conta Asaas (nós cobrando o clube). Não
-- confundir com a conta Asaas do próprio clube, que serve para ele cobrar
-- os responsáveis — essa vem no passo seguinte.
alter table clubs add column asaas_customer_id text;
alter table clubs add column asaas_subscription_id text;

-- Clube de demonstração: dados de exemplo, restaurados periodicamente.
-- Marcado no banco para que a restauração nunca toque num clube real.
alter table clubs add column is_demo boolean not null default false;

alter table clubs add column canceled_at timestamptz;

-- Backfill antes de exigir o slug: os dois clubes existentes são seus e já
-- estão em produção, então entram como 'ativo' e não como 'trial'.
update clubs set slug = 'vertice-performance', status = 'ativo'
  where id = '8032c5ee-7bfa-4ad4-8be4-ba61013f8e98';
update clubs set slug = 'diretoria', status = 'ativo'
  where id = '502fb7cb-22a4-4364-97de-e8b0e320cea0';

alter table clubs alter column slug set not null;
alter table clubs add constraint clubs_slug_unique unique (slug);

-- Formato do slug: minúsculas, números e hífen. Sem isso, um cadastro
-- futuro poderia gravar algo que não sobrevive a uma URL.
alter table clubs add constraint clubs_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$');

-- Trial só faz sentido com prazo, e prazo só faz sentido em trial.
alter table clubs add constraint clubs_trial_shape check (
  (status <> 'trial') or (trial_ends_at is not null)
);

create index on clubs (status);

-- Leitura do clube já existe pra quem é do clube. O que falta é deixar o
-- slug legível por quem ainda não entrou: a tela de login em /c/<slug>
-- precisa mostrar de qual clube é o link antes de existir sessão.
create or replace function public.club_by_slug(p_slug text)
returns table (id uuid, name text, slug text, status text, is_demo boolean)
language sql
security definer
set search_path = public
stable
as $$
  select c.id, c.name, c.slug, c.status, c.is_demo
  from clubs c
  where c.slug = p_slug and c.status <> 'cancelado';
$$;

-- Só expõe nome e situação — nada de cota, dono ou identificadores de
-- pagamento. É por isso que é uma função, e não uma policy de select
-- liberando a tabela inteira pro anônimo.
revoke execute on function public.club_by_slug(text) from public;
grant execute on function public.club_by_slug(text) to anon, authenticated;
