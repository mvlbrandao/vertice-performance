-- Anamnese / plano de evolução do atleta baseado em ciclos de análise SWOT.
-- Cada ponto (força/fraqueza/oportunidade/ameaça) pode ter uma meta de
-- encontros individuais e treinos pra evoluir; encontros e treinos vinculados
-- ao ponto incrementam o progresso automaticamente. Quando o ciclo é
-- encerrado, uma nova análise recomeça do zero (histórico fica preservado).
create table athlete_swot_cycles (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete cascade,
  cycle_number int not null,
  status text not null default 'Aberto' check (status in ('Aberto', 'Fechado')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  created_by uuid not null references profiles(id),
  unique (athlete_id, cycle_number)
);

create index on athlete_swot_cycles (athlete_id);
alter table athlete_swot_cycles enable row level security;

create policy "coach manages swot_cycles" on athlete_swot_cycles for all
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');
create policy "athlete reads own swot_cycles" on athlete_swot_cycles for select
  using (athlete_id = (select athlete_id from my_profile()));
create policy "staff reads granted swot_cycles" on athlete_swot_cycles for select
  using (has_athlete_access(athlete_id));

create table athlete_swot_items (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references athlete_swot_cycles(id) on delete cascade,
  club_id uuid not null references clubs(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete cascade,
  category text not null check (category in ('Força', 'Fraqueza', 'Oportunidade', 'Ameaça')),
  author_role text not null check (author_role in ('coach', 'athlete')),
  description text not null,
  target_meetings int not null default 0,
  target_trainings int not null default 0,
  meetings_done int not null default 0,
  trainings_done int not null default 0,
  status text not null default 'Aberto' check (status in ('Aberto', 'Concluído')),
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create index on athlete_swot_items (cycle_id);
create index on athlete_swot_items (athlete_id);
alter table athlete_swot_items enable row level security;

create policy "coach manages swot_items" on athlete_swot_items for all
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');
create policy "athlete reads own swot_items" on athlete_swot_items for select
  using (athlete_id = (select athlete_id from my_profile()));
create policy "athlete inserts own swot_items" on athlete_swot_items for insert
  with check (
    athlete_id = (select athlete_id from my_profile())
    and (select role from my_profile()) = 'athlete'
    and author_role = 'athlete'
  );
create policy "athlete updates own authored swot_items" on athlete_swot_items for update
  using (
    athlete_id = (select athlete_id from my_profile())
    and (select role from my_profile()) = 'athlete'
    and author_role = 'athlete'
  )
  with check (
    athlete_id = (select athlete_id from my_profile())
    and (select role from my_profile()) = 'athlete'
    and author_role = 'athlete'
  );
create policy "staff reads granted swot_items" on athlete_swot_items for select
  using (has_athlete_access(athlete_id));

alter table meetings add column swot_item_id uuid references athlete_swot_items(id) on delete set null;
alter table exercises add column swot_item_id uuid references athlete_swot_items(id) on delete set null;

create or replace function increment_swot_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.swot_item_id is not null then
    if TG_TABLE_NAME = 'meetings' then
      update athlete_swot_items set meetings_done = meetings_done + 1 where id = new.swot_item_id;
    elsif TG_TABLE_NAME = 'exercises' then
      update athlete_swot_items set trainings_done = trainings_done + 1 where id = new.swot_item_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger meetings_increment_swot after insert on meetings
  for each row execute function increment_swot_progress();
create trigger exercises_increment_swot after insert on exercises
  for each row execute function increment_swot_progress();
