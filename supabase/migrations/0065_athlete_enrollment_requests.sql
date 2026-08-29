-- Matrícula pública, sem login, em /c/[slug]/matricula. Cria só um pedido
-- pendente — o atleta de verdade e a cobrança no Asaas só nascem quando o
-- treinador aprova (ver lib/actions/enrollment.ts). Sem policy de insert
-- pra ninguém: a escrita pública passa pelo client de serviço
-- (createAdminClient), no mesmo padrão do cadastro público de clube em
-- lib/actions/signup.ts — RLS aqui só protege leitura/gestão pelo treinador.

create table athlete_enrollment_requests (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  status text not null default 'Pendente' check (status in ('Pendente', 'Aprovado', 'Rejeitado')),
  full_name text not null,
  birth_date date,
  sex text check (sex in ('M', 'F')),
  team text,
  category text,
  guardian_name text not null,
  guardian_cpf text not null,
  guardian_email text not null,
  guardian_phone text,
  instagram text,
  guardian_consent_at timestamptz not null,
  submitter_ip text,
  created_athlete_id uuid references athletes(id) on delete set null,
  requested_at timestamptz not null default now(),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  review_notes text
);

create index on athlete_enrollment_requests (club_id, status);

alter table athlete_enrollment_requests enable row level security;

create policy "coach manages enrollment requests" on athlete_enrollment_requests for all
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');
