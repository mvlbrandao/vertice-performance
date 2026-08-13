-- Origem do cadastro público, usada só para limitar abuso: cadastro aberto
-- sem freio vira alvo de robô, e cada clube criado ocupa espaço e polui a
-- lista de clientes. Três por IP a cada 24h.
--
-- Guardado em `clubs` em vez de tabela própria porque o volume não
-- justifica uma tabela, e o índice por (ip, data) resolve a contagem.
alter table clubs add column signup_ip text;
create index on clubs (signup_ip, created_at desc);
