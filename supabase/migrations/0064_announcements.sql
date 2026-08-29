-- Mural de avisos: comunicação em massa do treinador pro time, sem depender
-- de push pontual de eventos do sistema (cobrança, jogo, cancelamento).
-- Alvo é opcional por time e/ou categoria (sub) — os dois nulos significa
-- "todos". Staff só enxerga avisos cujo alvo alcance algum atleta que ele já
-- tem acesso concedido (athlete_staff_access), nunca o clube inteiro — seguindo
-- o mesmo modelo aditivo de 0023_athlete_staff_access.sql.

create table announcements (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  created_by uuid not null references profiles(id),
  title text not null,
  body text not null,
  target_team text,
  target_category text,
  created_at timestamptz not null default now()
);

create index on announcements (club_id, created_at desc);

create table announcement_reads (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references announcements(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  unique (announcement_id, profile_id)
);

create index on announcement_reads (profile_id);

alter table announcements enable row level security;
alter table announcement_reads enable row level security;

create policy "coach manages announcements" on announcements for all
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');

create policy "athlete reads own audience announcements" on announcements for select
  using (
    (select role from my_profile()) = 'athlete'
    and exists (
      select 1 from athletes a
      where a.id = (select athlete_id from my_profile())
        and a.club_id = announcements.club_id
        and (announcements.target_team is null or a.team = announcements.target_team)
        and (announcements.target_category is null or a.category = announcements.target_category)
    )
  );

create policy "staff reads audience announcements via granted athletes" on announcements for select
  using (
    (select role from my_profile()) = 'staff'
    and exists (
      select 1 from athletes a
      join athlete_staff_access g on g.athlete_id = a.id
      where g.staff_profile_id = auth.uid()
        and a.club_id = announcements.club_id
        and (announcements.target_team is null or a.team = announcements.target_team)
        and (announcements.target_category is null or a.category = announcements.target_category)
    )
  );

create policy "profile marks own reads" on announcement_reads for insert
  with check (profile_id = auth.uid());

create policy "profile reads own read marks" on announcement_reads for select
  using (profile_id = auth.uid());
