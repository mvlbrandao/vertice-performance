-- Gamificação: desafios extras lançados pelo treinador, o atleta posta a
-- evidência (link do Instagram, sem consumir armazenamento nosso) e ganha
-- pontos quando aprovado. Fica separado das 7 métricas reais do card FIFA
-- de propósito — pontos de desafio são reconhecimento, não um dado
-- objetivo, então não devem distorcer o overall calculado.
create table challenges (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  athlete_id uuid references athletes(id) on delete cascade,
  title text not null,
  description text not null,
  tier text not null default 'Bronze' check (tier in ('Bronze', 'Prata', 'Ouro')),
  points int not null check (points > 0),
  target_position text,
  status text not null default 'Ativo' check (status in ('Ativo', 'Arquivado')),
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create index on challenges (club_id, status);
create index on challenges (athlete_id);

alter table challenges enable row level security;

create policy "coach manages challenges" on challenges for all
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');

create policy "athlete reads challenges in their club" on challenges for select
  using (
    club_id = (select club_id from my_profile())
    and (select role from my_profile()) = 'athlete'
    and status = 'Ativo'
    and (athlete_id is null or athlete_id = (select athlete_id from my_profile()))
  );

create table challenge_submissions (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  challenge_id uuid not null references challenges(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete cascade,
  instagram_url text not null,
  notes text,
  status text not null default 'Pendente' check (status in ('Pendente', 'Aprovado', 'Rejeitado')),
  points_awarded int,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  review_notes text
);

create index on challenge_submissions (club_id, status);
create index on challenge_submissions (athlete_id, status);
create index on challenge_submissions (challenge_id);

alter table challenge_submissions enable row level security;

create policy "coach manages submissions" on challenge_submissions for all
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');

create policy "athlete creates own submission" on challenge_submissions for insert
  with check (
    club_id = (select club_id from my_profile())
    and athlete_id = (select athlete_id from my_profile())
    and (select role from my_profile()) = 'athlete'
  );

create policy "athlete reads own submissions" on challenge_submissions for select
  using (
    athlete_id = (select athlete_id from my_profile())
    and (select role from my_profile()) = 'athlete'
  );
