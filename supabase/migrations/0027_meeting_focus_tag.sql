-- Tag de foco opcional no encontro, pra reaproveitar o catálogo de pontos
-- SWOT (força/fraqueza) como sugestão rápida, mesmo sem um ciclo aberto.
alter table meetings add column if not exists focus_tag text;
