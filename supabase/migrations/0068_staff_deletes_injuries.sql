-- Physio é normalmente quem cria o registro de lesão — falta o direito de
-- apagar um lançamento errado, que os demais campos de "manage" já têm
-- (ver 0067). Sem isso a UI mostraria um botão de excluir que sempre falha.
create policy "staff deletes granted injuries" on athlete_injuries for delete
  using (has_athlete_manage_access(athlete_id) and has_staff_area('saude'));
