-- Convite por link: o treinador gera um link e manda por WhatsApp, sem
-- depender do envio de e-mail do Supabase (que já travou por limite de
-- taxa mais de uma vez na operação real).
--
-- O token fica guardado como hash, não em texto puro: se o banco vazar,
-- ninguém consegue reconstruir os links e criar contas. O valor original
-- só existe na URL entregue ao treinador.
create table invite_links (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  token_hash text not null unique,
  role user_role not null,
  athlete_id uuid references athletes(id) on delete cascade,
  full_name text not null,
  title text,
  created_by uuid not null references profiles(id),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  constraint invite_target_shape check (
    (role = 'athlete' and athlete_id is not null) or
    (role <> 'athlete' and athlete_id is null)
  )
);

create index on invite_links (club_id);
create index on invite_links (token_hash);

alter table invite_links enable row level security;

create policy "coach manages invite links" on invite_links for all
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');
