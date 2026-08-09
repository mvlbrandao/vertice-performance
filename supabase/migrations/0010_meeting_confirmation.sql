-- Atleta confirma presença num encontro agendado; mesmo padrão de
-- restrição de coluna já usado em exercises/diet_items.
alter table meetings add column athlete_confirmed boolean not null default false;

create or replace function guard_athlete_confirm_only()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_athlete boolean;
begin
  select (role = 'athlete') into is_athlete from profiles where id = auth.uid();
  if is_athlete then
    if (to_jsonb(new) - 'athlete_confirmed') is distinct from (to_jsonb(old) - 'athlete_confirmed') then
      raise exception 'Atletas só podem confirmar presença.';
    end if;
  end if;
  return new;
end;
$$;

create trigger meetings_guard_athlete_update
  before update on meetings
  for each row execute function guard_athlete_confirm_only();

create policy "athlete confirms own meeting" on meetings for update
  using (athlete_id = (select athlete_id from my_profile()) and (select role from my_profile()) = 'athlete')
  with check (athlete_id = (select athlete_id from my_profile()) and (select role from my_profile()) = 'athlete');
