-- Evita que o alerta de mudança de score seja "engolido" por uma
-- renderização duplicada (ex.: prefetch/dupla requisição da mesma
-- página): a leitura só mostra o alerta se conseguir marcar o
-- snapshot como reconhecido (update condicionado a acknowledged =
-- false), então só uma das requisições concorrentes "ganha" o alerta
-- — nenhuma o perde silenciosamente.
alter table athlete_score_snapshots add column acknowledged boolean not null default false;

create policy "coach acknowledges score snapshots" on athlete_score_snapshots for update
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');

create policy "athlete acknowledges own score snapshots" on athlete_score_snapshots for update
  using (
    athlete_id = (select athlete_id from my_profile())
    and (select role from my_profile()) = 'athlete'
  )
  with check (
    athlete_id = (select athlete_id from my_profile())
    and (select role from my_profile()) = 'athlete'
  );
