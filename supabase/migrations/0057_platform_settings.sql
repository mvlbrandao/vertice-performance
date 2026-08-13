-- Configuração comercial da plataforma: preço, dias de teste e cota de
-- atletas por licença. Fica no banco, e não em constante no código, porque
-- muda sem aviso e não pode depender de deploy — foi pedido explícito.
--
-- Linha única, garantida por uma chave fixa. Tabela de configuração com
-- várias linhas sempre acaba com duas e ninguém sabe qual vale.
create table platform_settings (
  id boolean primary key default true check (id),
  plan_name text not null default 'Plano único',
  price_cents integer not null default 0 check (price_cents >= 0),
  trial_days integer not null default 15 check (trial_days between 0 and 365),
  max_athletes integer not null default 50 check (max_athletes > 0),
  retention_days integer not null default 60 check (retention_days between 1 and 3650),
  updated_at timestamptz not null default now()
);

insert into platform_settings (id) values (true);

-- Só a plataforma mexe nisso, via service role. Nenhum clube pode ler ou
-- alterar o próprio preço.
alter table platform_settings enable row level security;
revoke all on platform_settings from anon, authenticated;

-- Cota e cortesia por clube. O padrão vem de platform_settings; o clube só
-- carrega o que foge do padrão — assim mudar o plano vale pra todos sem
-- precisar reescrever clube a clube.
alter table clubs add column max_athletes_override integer check (max_athletes_override > 0);

-- Bonificação: cortesia até uma data, e/ou preço próprio negociado. Com
-- courtesy_until no futuro o clube não é cobrado nem bloqueado.
alter table clubs add column courtesy_until timestamptz;
alter table clubs add column price_cents_override integer check (price_cents_override >= 0);
alter table clubs add column courtesy_reason text;

comment on column clubs.courtesy_until is 'Bonificação: acesso liberado sem cobrança até esta data.';
