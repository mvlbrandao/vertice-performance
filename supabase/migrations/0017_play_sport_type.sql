-- Mesa Tática: cada jogada passa a indicar o esporte, pra desenhar a quadra/campo
-- certos e oferecer formações pré-definidas compatíveis.
alter table plays add column sport_type text not null default 'futsal'
  check (sport_type in ('futsal', 'campo', 'fut7'));
