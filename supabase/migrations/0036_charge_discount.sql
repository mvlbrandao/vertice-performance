-- Desconto por lançamento — amount_cents continua sendo o valor cheio
-- (nominal), discount_cents é o abatimento. "Valor líquido" (o que
-- realmente entra) é sempre amount_cents - discount_cents; relatórios
-- devem somar o líquido, não o bruto.
alter table athlete_charges add column discount_cents int not null default 0
  check (discount_cents >= 0);
