-- 0067 fez a policy de staff em `games` checar `game_lineups` com um EXISTS
-- direto — mas a policy de atleta em `game_lineups` ("athlete reads own
-- published lineup", 0030) por sua vez consulta `games`. games → game_lineups
-- → games fecha um ciclo, e o Postgres detecta como recursão infinita
-- (42P17) assim que um staff tenta ler `games`. Uma function security
-- definer quebra o ciclo: por rodar com bypass de RLS (dono é o role da
-- migration, com bypassrls), a consulta interna a game_lineups não
-- reavalia a policy de atleta.
create or replace function staff_has_lineup_access(target_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from game_lineups gl
    where gl.game_id = target_game_id and has_athlete_access(gl.athlete_id)
  );
$$;

drop policy "staff reads granted games" on games;
create policy "staff reads granted games" on games for select
  using (has_staff_area('jogos') and staff_has_lineup_access(games.id));
