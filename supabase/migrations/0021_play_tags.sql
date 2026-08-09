-- Tags livres pra organizar a biblioteca de jogadas da Mesa Tática
-- (ex.: "Escanteio ofensivo", "Saída de bola", "Transição defensiva").
alter table plays add column tags text[] not null default '{}';
