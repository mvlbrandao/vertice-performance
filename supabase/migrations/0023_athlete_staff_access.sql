-- Concessão de acesso por atleta pra profissionais (staff) que não são o
-- treinador dono do clube — ex.: preparador físico, treinador de específicos
-- externo. O coach concede acesso atleta a atleta; nunca acesso ao clube
-- inteiro. Todas as políticas abaixo são aditivas: nada do que já existia
-- pro coach ou pro atleta é alterado ou removido.
create table athlete_staff_access (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete cascade,
  staff_profile_id uuid not null references profiles(id) on delete cascade,
  granted_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  unique (athlete_id, staff_profile_id)
);

create index on athlete_staff_access (staff_profile_id);
create index on athlete_staff_access (athlete_id);
alter table athlete_staff_access enable row level security;

create policy "coach manages access grants" on athlete_staff_access for all
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');

create policy "staff reads own grants" on athlete_staff_access for select
  using (staff_profile_id = auth.uid());

create or replace function has_athlete_access(target_athlete_id uuid)
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
  );
$$;

create policy "staff reads granted athletes" on athletes for select
  using (has_athlete_access(id));

create policy "staff reads granted checkins" on checkins for select
  using (has_athlete_access(athlete_id));

create policy "staff manages granted exercises" on exercises for all
  using (has_athlete_access(athlete_id))
  with check (has_athlete_access(athlete_id));

create policy "staff manages granted meetings" on meetings for all
  using (has_athlete_access(athlete_id))
  with check (has_athlete_access(athlete_id));

create policy "staff manages granted mental_notes" on mental_notes for all
  using (has_athlete_access(athlete_id))
  with check (has_athlete_access(athlete_id));

create policy "staff manages granted media_items" on media_items for all
  using (has_athlete_access(athlete_id))
  with check (has_athlete_access(athlete_id));
