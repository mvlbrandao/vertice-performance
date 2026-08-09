-- Um jogo lançado pro time (ex.: ECMP) precisa também do sub (ex.: SUB12) pra
-- não puxar atletas de outras categorias do mesmo clube pra súmula/linha do tempo.
alter table games add column target_category text;
