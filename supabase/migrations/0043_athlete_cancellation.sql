-- Solicitação/registro de cancelamento de contrato do atleta. O atleta
-- pode solicitar, mas só produz efeito (desativação + cancelamento
-- financeiro) quando o treinador aprova — segue o padrão comum de
-- gestão de academias/clubes (cancelamento "sob revisão", não
-- self-service puro), e cada linha aprovada/rejeitada vira histórico
-- permanente pra análise de motivos de churn.
create table athlete_cancellation_requests (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete cascade,
  reason_category text not null check (
    reason_category in (
      'Financeiro',
      'Mudança de clube',
      'Mudança de cidade',
      'Insatisfação',
      'Lesão / Parou de praticar',
      'Outro'
    )
  ),
  reason_detail text,
  status text not null default 'Pendente' check (status in ('Pendente', 'Aprovado', 'Rejeitado')),
  cancel_future_charges boolean not null default false,
  requested_by uuid not null references profiles(id),
  requested_by_role text not null check (requested_by_role in ('athlete', 'coach')),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  review_notes text
);

create index on athlete_cancellation_requests (club_id, status);
create index on athlete_cancellation_requests (athlete_id);

alter table athlete_cancellation_requests enable row level security;

create policy "coach manages cancellation requests" on athlete_cancellation_requests for all
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');

create policy "athlete creates own cancellation request" on athlete_cancellation_requests for insert
  with check (
    club_id = (select club_id from my_profile())
    and athlete_id = (select athlete_id from my_profile())
    and (select role from my_profile()) = 'athlete'
  );

create policy "athlete views own cancellation requests" on athlete_cancellation_requests for select
  using (
    athlete_id = (select athlete_id from my_profile())
    and (select role from my_profile()) = 'athlete'
  );
