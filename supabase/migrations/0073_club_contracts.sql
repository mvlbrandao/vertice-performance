-- Contratos dos clubes com a plataforma.
--
-- Até aqui o "contrato" era só a licença: status, fim do teste e cortesia
-- em clubs, preço e cota vindos de platform_settings. Isso diz o que o
-- clube pode fazer HOJE, mas não o que foi combinado: desde quando, por
-- quanto, em que ciclo, se renova sozinho, quem assinou, qual o documento.
-- Sem isso não há como saber quais acordos vencem no mês que vem nem se o
-- preço cobrado ainda bate com o negociado.
--
-- Um clube tem vários contratos ao longo do tempo (renovações, mudança de
-- preço) e no máximo UM vigente. A licença continua mandando no acesso —
-- o contrato é o registro comercial, e a tela de admin avisa quando os
-- dois divergem.
create table club_contracts (
  id uuid primary key default gen_random_uuid(),
  -- Número sequencial legível ("CT-0007"), para citar o contrato por telefone.
  number integer generated always as identity,
  club_id uuid not null references clubs(id) on delete cascade,
  status text not null default 'rascunho'
    check (status in ('rascunho', 'vigente', 'encerrado', 'cancelado')),
  plan_name text not null check (length(trim(plan_name)) > 0),
  -- Valor de CADA ciclo de cobrança (um contrato anual de R$ 1.200 grava 120000).
  price_cents integer not null check (price_cents >= 0),
  -- null = cota padrão da plataforma (platform_settings.max_athletes).
  max_athletes integer check (max_athletes > 0),
  billing_cycle text not null default 'mensal'
    check (billing_cycle in ('mensal', 'trimestral', 'semestral', 'anual')),
  starts_on date not null,
  -- null = prazo indeterminado.
  ends_on date,
  auto_renew boolean not null default true,
  signed_on date,
  signer_name text,
  signer_role text,
  terms_version text,
  -- Caminho no bucket privado club-contracts: {club_id}/{contract_id}/{arquivo}.pdf
  document_path text,
  notes text,
  closed_at timestamptz,
  closed_reason text,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint club_contracts_period_check check (ends_on is null or ends_on >= starts_on)
);

-- No máximo um contrato vigente por clube.
create unique index club_contracts_one_active_per_club on club_contracts (club_id)
  where status = 'vigente';
create index club_contracts_club_idx on club_contracts (club_id, starts_on desc);
create index club_contracts_status_end_idx on club_contracts (status, ends_on);

-- Só a plataforma enxerga contratos, via service role. O clube não lê nem
-- o próprio: preço negociado e notas internas são nossos.
alter table club_contracts enable row level security;
revoke all on club_contracts from anon, authenticated;

-- Documento assinado (PDF). Bucket privado e SEM política em storage.objects:
-- só a service role lê e grava, e a tela de admin gera o link assinado depois
-- de checar que quem pede é o administrador (mesmo desenho do bucket
-- data-exports, 0066).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('club-contracts', 'club-contracts', false, 10485760, array['application/pdf']);

-- Retrato inicial: quem já paga ganha um contrato vigente derivado da
-- licença atual, para a tela não nascer vazia. Teste, demo e bloqueado/
-- cancelado ficam de fora — não há acordo comercial a registrar.
insert into club_contracts (
  club_id, status, plan_name, price_cents, max_athletes, billing_cycle,
  starts_on, auto_renew, notes
)
select
  c.id,
  'vigente',
  s.plan_name,
  coalesce(c.price_cents_override, s.price_cents),
  c.max_athletes_override,
  'mensal',
  coalesce(c.converted_at, c.created_at)::date,
  true,
  'Gerado automaticamente a partir da licença vigente quando o módulo de contratos foi criado. Confira os dados e anexe o documento assinado.'
from clubs c
cross join platform_settings s
where c.status in ('ativo', 'atrasado')
  and not c.is_demo;
