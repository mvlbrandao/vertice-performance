-- Um atleta pode atuar em várias posições (futsal e campo), então o
-- campo de posição vira lista em vez de valor único.
alter table athletes
  alter column position type text[]
  using case when position is null then null else array[position] end;
