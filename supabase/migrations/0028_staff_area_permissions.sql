-- Permissão por área funcional, além da permissão por atleta que já existia.
-- Cada staff tem um conjunto de áreas liberadas (treino, agenda, saude,
-- anamnese, financeiro); o acesso efetivo a um dado é a INTERSEÇÃO entre "tem
-- o atleta liberado" (athlete_staff_access, já existente) e "tem a área
-- liberada" (staff_areas, novo). Ex.: quem só tem 'financeiro' não enxerga
-- treino/agenda/anamnese dos atletas liberados, mesmo tendo acesso a eles.
--
-- Backfill: staff já convidado antes desta migração recebe treino+agenda+
-- saude (o que já podia acessar via has_athlete_access antes de existir esse
-- controle), preservando o comportamento atual. anamnese e financeiro ficam
-- de fora do backfill porque staff nunca teve acesso a esses dados — são
-- área novas que o coach concede explicitamente a partir de agora.
alter table profiles add column staff_areas text[] not null default '{}';

update profiles set staff_areas = array['treino', 'agenda', 'saude']
where role = 'staff';

create or replace function has_staff_area(area text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select area = any(coalesce((select staff_areas from profiles where id = auth.uid()), '{}'));
$$;

-- exercises (treino)
drop policy "staff reads granted exercises" on exercises;
create policy "staff reads granted exercises" on exercises for select
  using (has_athlete_access(athlete_id) and has_staff_area('treino'));
drop policy "staff writes granted exercises" on exercises;
create policy "staff writes granted exercises" on exercises for insert
  with check (has_athlete_manage_access(athlete_id) and has_staff_area('treino'));
drop policy "staff updates granted exercises" on exercises;
create policy "staff updates granted exercises" on exercises for update
  using (has_athlete_manage_access(athlete_id) and has_staff_area('treino'))
  with check (has_athlete_manage_access(athlete_id) and has_staff_area('treino'));

-- meetings (agenda)
drop policy "staff reads granted meetings" on meetings;
create policy "staff reads granted meetings" on meetings for select
  using (has_athlete_access(athlete_id) and has_staff_area('agenda'));
drop policy "staff writes granted meetings" on meetings;
create policy "staff writes granted meetings" on meetings for insert
  with check (has_athlete_manage_access(athlete_id) and has_staff_area('agenda'));
drop policy "staff updates granted meetings" on meetings;
create policy "staff updates granted meetings" on meetings for update
  using (has_athlete_manage_access(athlete_id) and has_staff_area('agenda'))
  with check (has_athlete_manage_access(athlete_id) and has_staff_area('agenda'));

-- mental_notes (saude)
drop policy "staff reads granted mental_notes" on mental_notes;
create policy "staff reads granted mental_notes" on mental_notes for select
  using (has_athlete_access(athlete_id) and has_staff_area('saude'));
drop policy "staff writes granted mental_notes" on mental_notes;
create policy "staff writes granted mental_notes" on mental_notes for insert
  with check (has_athlete_manage_access(athlete_id) and has_staff_area('saude'));

-- media_items (saude)
drop policy "staff reads granted media_items" on media_items;
create policy "staff reads granted media_items" on media_items for select
  using (has_athlete_access(athlete_id) and has_staff_area('saude'));
drop policy "staff writes granted media_items" on media_items;
create policy "staff writes granted media_items" on media_items for insert
  with check (has_athlete_manage_access(athlete_id) and has_staff_area('saude'));

-- checkins (saude, leitura)
drop policy "staff reads granted checkins" on checkins;
create policy "staff reads granted checkins" on checkins for select
  using (has_athlete_access(athlete_id) and has_staff_area('saude'));

-- anamnese: já existia uma política de leitura pra staff (0025), sem
-- controle de área — substituída aqui pela versão com has_staff_area.
drop policy "staff reads granted swot_cycles" on athlete_swot_cycles;
create policy "staff reads granted swot_cycles" on athlete_swot_cycles for select
  using (has_athlete_access(athlete_id) and has_staff_area('anamnese'));
drop policy "staff reads granted swot_items" on athlete_swot_items;
create policy "staff reads granted swot_items" on athlete_swot_items for select
  using (has_athlete_access(athlete_id) and has_staff_area('anamnese'));

-- financeiro: já existia uma política de leitura pra staff (0026), sem
-- controle de área — substituída aqui pela versão com has_staff_area.
drop policy "staff reads granted charges" on athlete_charges;
create policy "staff reads granted charges" on athlete_charges for select
  using (has_athlete_access(athlete_id) and has_staff_area('financeiro'));
