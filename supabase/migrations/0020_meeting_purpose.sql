-- Classifica o encontro como treino coletivo ou atendimento específico
-- (individual), pra dar mais contexto na agenda e na linha do tempo.
alter table meetings add column purpose text not null default 'Específico'
  check (purpose in ('Treino', 'Específico'));
