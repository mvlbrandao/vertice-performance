-- Corrige o desenho de 0055.
--
-- Lá a chave do Asaas ficava numa coluna de `clubs`, protegida por
-- `revoke select (coluna)`. Conferindo com has_column_privilege logo depois,
-- anon e authenticated continuavam lendo: o SELECT vem concedido no nível da
-- tabela, e revogar uma coluna não desfaz uma concessão de tabela. Consertar
-- por coluna exigiria revogar a tabela inteira e reconceder coluna a coluna,
-- e qualquer coluna nova no futuro voltaria a vazar por padrão.
--
-- Além disso `clubs` é lido com select("*") em várias telas — credencial que
-- move dinheiro não pode morar numa tabela assim.
--
-- Solução: tabela separada, RLS ligado e **nenhuma policy**. Sem policy,
-- ninguém enxerga nada via RLS; só a service role, que roda no servidor,
-- passa. É garantia estrutural, não uma permissão que dá pra errar.
create table club_asaas_credentials (
  club_id uuid primary key references clubs(id) on delete cascade,
  api_key_encrypted text not null,
  webhook_token text not null unique,
  updated_at timestamptz not null default now()
);

alter table club_asaas_credentials enable row level security;
revoke all on club_asaas_credentials from anon, authenticated;

-- O que a tela do treinador precisa mostrar ("conectado como X desde tal
-- data") não é segredo e fica em clubs, onde o RLS normal já resolve.
alter table clubs drop column asaas_api_key_encrypted;
alter table clubs drop constraint clubs_asaas_webhook_token_unique;
alter table clubs drop column asaas_webhook_token;
