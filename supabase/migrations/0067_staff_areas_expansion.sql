-- Fecha a UI de staff: dá RLS pras áreas que ainda não tinham (lesões,
-- evolução/score, jogos) e remove a área 'financeiro' — decisão de produto
-- de 2026-08-29: dado financeiro do atleta é só do treinador/empresa, staff
-- nunca vê, então a política dormente de 0028 sai e a área some do catálogo
-- (ver lib/data/staffAreas.ts).

drop policy "staff reads granted charges" on athlete_charges;

-- lesões (saude): mesmo padrão view/manage de exercises em 0024/0028.
create policy "staff reads granted injuries" on athlete_injuries for select
  using (has_athlete_access(athlete_id) and has_staff_area('saude'));
create policy "staff writes granted injuries" on athlete_injuries for insert
  with check (has_athlete_manage_access(athlete_id) and has_staff_area('saude'));
create policy "staff updates granted injuries" on athlete_injuries for update
  using (has_athlete_manage_access(athlete_id) and has_staff_area('saude'))
  with check (has_athlete_manage_access(athlete_id) and has_staff_area('saude'));

-- evolução/score (treino): snapshot é síntese de desempenho, mesma área de exercises.
create policy "staff reads granted score_snapshots" on athlete_score_snapshots for select
  using (has_athlete_access(athlete_id) and has_staff_area('treino'));

-- jogos: área nova — só leitura, staff não faz súmula nem escalação.
create policy "staff reads granted game_events" on game_events for select
  using (has_athlete_access(athlete_id) and has_staff_area('jogos'));

create policy "staff reads granted game_lineups" on game_lineups for select
  using (has_athlete_access(athlete_id) and has_staff_area('jogos'));

create policy "staff reads granted game_reports" on game_reports for select
  using (has_athlete_access(athlete_id) and has_staff_area('jogos'));

create policy "staff reads granted games" on games for select
  using (
    has_staff_area('jogos')
    and exists (
      select 1 from game_lineups gl
      where gl.game_id = games.id and has_athlete_access(gl.athlete_id)
    )
  );
