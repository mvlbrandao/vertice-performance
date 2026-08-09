-- Registro de quais profissionais (staff) compõem a comissão técnica de
-- cada sub (categoria) de um clube parceiro — treinador, auxiliar,
-- preparador físico, preparador de goleiros, scout etc. É um diretório
-- organizacional: não concede acesso a atleta por si só (isso continua
-- sendo feito em athlete_staff_access, via Equipe) — só documenta "quem é
-- quem" por sub, base pro item de escalação de partida.
create table sub_staff_assignments (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  partner_club_category_id uuid not null references partner_club_categories(id) on delete cascade,
  staff_profile_id uuid not null references profiles(id) on delete cascade,
  role_title text not null,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  unique (partner_club_category_id, staff_profile_id)
);

create index on sub_staff_assignments (partner_club_category_id);
create index on sub_staff_assignments (staff_profile_id);
alter table sub_staff_assignments enable row level security;

create policy "coach manages sub staff assignments" on sub_staff_assignments for all
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');

create policy "staff reads own sub assignments" on sub_staff_assignments for select
  using (staff_profile_id = auth.uid());
