-- HR Performance — schema inicial (MVP)
-- Tabelas de tenancy/identidade, atletas, sub-coleções, RLS e triggers de proteção de coluna.

create extension if not exists "pgcrypto";

create type user_role as enum ('coach', 'athlete');

-- =========================================================
-- CLUBS
-- =========================================================
create table clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nutrition_entitlement boolean not null default false,
  storage_quota_bytes bigint not null default 21474836480,
  created_at timestamptz not null default now()
);

-- =========================================================
-- ATHLETES
-- =========================================================
create table athletes (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  full_name text not null,
  jersey_num int,
  category text,
  position text,
  team text,
  birth_date date,
  guardian_name text,
  guardian_phone text,
  athlete_phone text,
  instagram text,
  joined_at date not null default current_date,
  photo_url text,
  photo_color text,
  height_cm numeric,
  weight_kg numeric,
  bmi numeric,
  current_pain text default 'Nenhuma',
  guardian_consent_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- PROFILES (1:1 com auth.users)
-- =========================================================
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  club_id uuid not null references clubs(id) on delete restrict,
  role user_role not null,
  full_name text not null,
  athlete_id uuid references athletes(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table athletes add constraint athletes_created_by_fkey
  foreign key (created_by) references profiles(id);

-- =========================================================
-- SUB-COLEÇÕES DO ATLETA
-- =========================================================
create table mental_notes (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  club_id uuid not null references clubs(id) on delete cascade,
  author_id uuid not null references profiles(id),
  title text not null,
  body text not null,
  confidence_score smallint check (confidence_score between 0 and 10),
  video_url text,
  entry_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table game_reports (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  club_id uuid not null references clubs(id) on delete cascade,
  author_id uuid not null references profiles(id),
  opponent text not null,
  strengths text,
  improve text,
  entry_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table media_items (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  club_id uuid not null references clubs(id) on delete cascade,
  author_id uuid not null references profiles(id),
  label text not null,
  media_type text not null check (media_type in ('video', 'image')),
  storage_path text,
  thumbnail_color text,
  entry_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table exercises (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  club_id uuid not null references clubs(id) on delete cascade,
  prescribed_by uuid not null references profiles(id),
  name text not null,
  description text,
  focus text,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table exercise_videos (
  id uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references exercises(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete cascade,
  club_id uuid not null references clubs(id) on delete cascade,
  storage_path text not null,
  label text,
  status text not null default 'Pendente' check (status in ('Pendente', 'Avaliado')),
  coach_comment text,
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  submitted_at timestamptz not null default now()
);

create table diet_items (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  club_id uuid not null references clubs(id) on delete cascade,
  prescribed_by uuid not null references profiles(id),
  name text not null,
  description text,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table checkins (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  club_id uuid not null references clubs(id) on delete cascade,
  fatigue_level smallint not null check (fatigue_level between 1 and 5),
  pain_notes text,
  training_done boolean not null default false,
  diet_done boolean not null default false,
  checkin_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (athlete_id, checkin_date)
);

create table meetings (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  club_id uuid not null references clubs(id) on delete cascade,
  created_by uuid not null references profiles(id),
  title text not null,
  meeting_type text not null check (meeting_type in ('Presencial', 'Videochamada')),
  scheduled_date date not null,
  scheduled_time time not null,
  notes text,
  status text not null default 'Agendado' check (status in ('Agendado', 'Concluído', 'Cancelado')),
  created_at timestamptz not null default now()
);

create table data_requests (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  club_id uuid not null references clubs(id) on delete cascade,
  requested_by uuid not null references profiles(id),
  request_type text not null check (request_type in ('export', 'deletion')),
  status text not null default 'Pendente' check (status in ('Pendente', 'Em andamento', 'Concluído')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- placeholder para a fase futura da Mesa Tática
create table plays (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  created_by uuid not null references profiles(id),
  name text not null,
  target_type text not null check (target_type in ('athlete', 'team')),
  target_athlete_id uuid references athletes(id) on delete cascade,
  target_team text,
  svg_content text,
  frames jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- =========================================================
-- ÍNDICES
-- =========================================================
create index on athletes (club_id);
create index on mental_notes (athlete_id);
create index on mental_notes (club_id);
create index on game_reports (athlete_id);
create index on game_reports (club_id);
create index on media_items (athlete_id);
create index on media_items (club_id);
create index on exercises (athlete_id);
create index on exercises (club_id);
create index on exercise_videos (exercise_id);
create index on exercise_videos (athlete_id);
create index on exercise_videos (club_id);
create index on diet_items (athlete_id);
create index on diet_items (club_id);
create index on checkins (club_id);
create index on meetings (athlete_id);
create index on meetings (club_id, scheduled_date);
create index on data_requests (athlete_id);
create index on data_requests (club_id);
create index on plays (club_id);
create index on plays (target_athlete_id);
create index on profiles (club_id);

-- =========================================================
-- HELPER: my_profile()
-- =========================================================
create or replace function my_profile()
returns table (club_id uuid, role user_role, athlete_id uuid)
language sql
security definer
stable
set search_path = public
as $$
  select club_id, role, athlete_id from profiles where id = auth.uid()
$$;

-- =========================================================
-- TRIGGER: impede que o atleta altere qualquer coluna
-- além de `done` em exercises/diet_items
-- =========================================================
create or replace function guard_athlete_done_only()
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
    if (to_jsonb(new) - 'done') is distinct from (to_jsonb(old) - 'done') then
      raise exception 'Atletas só podem alterar o campo "done".';
    end if;
  end if;
  return new;
end;
$$;

create trigger exercises_guard_athlete_update
  before update on exercises
  for each row execute function guard_athlete_done_only();

create trigger diet_items_guard_athlete_update
  before update on diet_items
  for each row execute function guard_athlete_done_only();

-- =========================================================
-- RLS
-- =========================================================
alter table clubs enable row level security;
alter table profiles enable row level security;
alter table athletes enable row level security;
alter table mental_notes enable row level security;
alter table game_reports enable row level security;
alter table media_items enable row level security;
alter table exercises enable row level security;
alter table exercise_videos enable row level security;
alter table diet_items enable row level security;
alter table checkins enable row level security;
alter table meetings enable row level security;
alter table data_requests enable row level security;
alter table plays enable row level security;

-- clubs: leitura para qualquer perfil do clube; sem update client-side no MVP
create policy "read own club" on clubs for select
  using (id = (select club_id from my_profile()));

-- profiles: cada usuário lê/edita (campos limitados) o próprio perfil; sem insert client-side
create policy "read own profile" on profiles for select
  using (id = auth.uid());
create policy "update own profile" on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- athletes
create policy "coach manages club athletes" on athletes for all
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');
create policy "athlete reads own row" on athletes for select
  using (id = (select athlete_id from my_profile()));

-- mental_notes (autoria do coach; atleta só lê)
create policy "coach manages mental_notes" on mental_notes for all
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');
create policy "athlete reads own mental_notes" on mental_notes for select
  using (athlete_id = (select athlete_id from my_profile()));

-- game_reports (autoria do coach; atleta só lê)
create policy "coach manages game_reports" on game_reports for all
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');
create policy "athlete reads own game_reports" on game_reports for select
  using (athlete_id = (select athlete_id from my_profile()));

-- media_items (autoria do coach; atleta só lê)
create policy "coach manages media_items" on media_items for all
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');
create policy "athlete reads own media_items" on media_items for select
  using (athlete_id = (select athlete_id from my_profile()));

-- exercises (coach cria/gerencia; atleta lê e faz update, restrito a `done` pelo trigger)
create policy "coach manages exercises" on exercises for all
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');
create policy "athlete reads own exercises" on exercises for select
  using (athlete_id = (select athlete_id from my_profile()));
create policy "athlete toggles own exercise done" on exercises for update
  using (athlete_id = (select athlete_id from my_profile()) and (select role from my_profile()) = 'athlete')
  with check (athlete_id = (select athlete_id from my_profile()) and (select role from my_profile()) = 'athlete');

-- exercise_videos (atleta envia os próprios; coach lê/avalia do clube)
create policy "athlete manages own exercise_videos insert/select" on exercise_videos for insert
  with check (athlete_id = (select athlete_id from my_profile()) and (select role from my_profile()) = 'athlete');
create policy "athlete reads own exercise_videos" on exercise_videos for select
  using (athlete_id = (select athlete_id from my_profile()));
create policy "coach reads club exercise_videos" on exercise_videos for select
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');
create policy "coach reviews club exercise_videos" on exercise_videos for update
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');

-- diet_items (coach cria/gerencia; atleta lê e faz update, restrito a `done` pelo trigger)
create policy "coach manages diet_items" on diet_items for all
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');
create policy "athlete reads own diet_items" on diet_items for select
  using (athlete_id = (select athlete_id from my_profile()));
create policy "athlete toggles own diet_item done" on diet_items for update
  using (athlete_id = (select athlete_id from my_profile()) and (select role from my_profile()) = 'athlete')
  with check (athlete_id = (select athlete_id from my_profile()) and (select role from my_profile()) = 'athlete');

-- checkins (só o próprio atleta escreve; coach lê do clube)
create policy "athlete manages own checkins" on checkins for all
  using (athlete_id = (select athlete_id from my_profile()) and (select role from my_profile()) = 'athlete')
  with check (athlete_id = (select athlete_id from my_profile()) and (select role from my_profile()) = 'athlete');
create policy "coach reads club checkins" on checkins for select
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');

-- meetings (coach cria/gerencia; atleta só lê os seus)
create policy "coach manages meetings" on meetings for all
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');
create policy "athlete reads own meetings" on meetings for select
  using (athlete_id = (select athlete_id from my_profile()));

-- data_requests (atleta cria/lê os próprios; coach lê/atualiza status do clube)
create policy "athlete creates own data_requests" on data_requests for insert
  with check (athlete_id = (select athlete_id from my_profile()) and (select role from my_profile()) = 'athlete');
create policy "athlete reads own data_requests" on data_requests for select
  using (athlete_id = (select athlete_id from my_profile()));
create policy "coach reads club data_requests" on data_requests for select
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');
create policy "coach resolves club data_requests" on data_requests for update
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');

-- plays (placeholder — mesma lógica coach/atleta, sem UI no MVP)
create policy "coach manages plays" on plays for all
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');
create policy "athlete reads own or team plays" on plays for select
  using (
    club_id = (select club_id from my_profile())
    and (
      target_athlete_id = (select athlete_id from my_profile())
      or target_team in (select team from athletes where id = (select athlete_id from my_profile()))
    )
  );
