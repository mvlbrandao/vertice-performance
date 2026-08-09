-- Necessário pra aplicar a curva de referência de IMC por idade correta
-- da OMS (meninos e meninas têm curvas diferentes).
create type athlete_sex as enum ('M', 'F');

alter table athletes add column sex athlete_sex;
