-- Permissão por usuário, não só por atleta: cada concessão de acesso tem um
-- nível — 'view' (só consulta) ou 'manage' (consulta + prescreve treino,
-- agenda encontro, registra nota/mídia). Padrão 'manage' preserva o
-- comportamento das políticas aditivas já criadas em 0023.
alter table athlete_staff_access add column access_level text not null default 'manage'
  check (access_level in ('view', 'manage'));

create or replace function has_athlete_manage_access(target_athlete_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from athlete_staff_access g
    where g.athlete_id = target_athlete_id
      and g.staff_profile_id = auth.uid()
      and g.access_level = 'manage'
  );
$$;

-- Substitui as políticas "for all" de 0023 por uma leitura (qualquer nível)
-- + uma escrita (só nível manage).
drop policy "staff manages granted exercises" on exercises;
create policy "staff reads granted exercises" on exercises for select
  using (has_athlete_access(athlete_id));
create policy "staff writes granted exercises" on exercises for insert
  with check (has_athlete_manage_access(athlete_id));
create policy "staff updates granted exercises" on exercises for update
  using (has_athlete_manage_access(athlete_id))
  with check (has_athlete_manage_access(athlete_id));

drop policy "staff manages granted meetings" on meetings;
create policy "staff reads granted meetings" on meetings for select
  using (has_athlete_access(athlete_id));
create policy "staff writes granted meetings" on meetings for insert
  with check (has_athlete_manage_access(athlete_id));
create policy "staff updates granted meetings" on meetings for update
  using (has_athlete_manage_access(athlete_id))
  with check (has_athlete_manage_access(athlete_id));

drop policy "staff manages granted mental_notes" on mental_notes;
create policy "staff reads granted mental_notes" on mental_notes for select
  using (has_athlete_access(athlete_id));
create policy "staff writes granted mental_notes" on mental_notes for insert
  with check (has_athlete_manage_access(athlete_id));

drop policy "staff manages granted media_items" on media_items;
create policy "staff reads granted media_items" on media_items for select
  using (has_athlete_access(athlete_id));
create policy "staff writes granted media_items" on media_items for insert
  with check (has_athlete_manage_access(athlete_id));
