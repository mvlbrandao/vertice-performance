-- Paleta de 3 cores por clube parceiro, usada como cor do avatar do
-- atleta quando ele pertence a esse clube.
alter table partner_clubs
  add column color_1 text,
  add column color_2 text,
  add column color_3 text;
