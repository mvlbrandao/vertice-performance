-- Vincula mídia, registro mental e relatório de jogo a um ponto da análise
-- SWOT, igual já existia pra treino e encontro. É só rastreabilidade (não
-- soma em meetings_done/trainings_done — isso continua exclusivo de
-- meetings/exercises, ver increment_swot_progress()).
alter table media_items add column swot_item_id uuid references athlete_swot_items(id) on delete set null;
alter table mental_notes add column swot_item_id uuid references athlete_swot_items(id) on delete set null;
alter table game_reports add column swot_item_id uuid references athlete_swot_items(id) on delete set null;
