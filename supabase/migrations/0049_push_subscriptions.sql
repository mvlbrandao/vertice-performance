-- Inscrições de push web (protocolo Web Push / VAPID). Cada linha é um
-- dispositivo/navegador em que o usuário ativou notificações — uma pessoa
-- pode ter várias (celular + desktop). endpoint é único por natureza do
-- protocolo (URL do serviço de push do navegador pra aquela inscrição).
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index on push_subscriptions (profile_id);

alter table push_subscriptions enable row level security;

create policy "user manages own push subscriptions" on push_subscriptions for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
