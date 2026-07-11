-- Treinador precisa enxergar os profiles (contas de login) dos atletas do
-- próprio clube — por exemplo, para saber se um atleta já tem conta
-- provisionada antes de oferecer o convite de novo.
create policy "coach reads club profiles"
  on profiles for select
  using (
    club_id = (select club_id from my_profile())
    and (select role from my_profile()) = 'coach'
  );
