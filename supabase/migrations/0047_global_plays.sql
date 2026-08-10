-- Jogadas padrão: biblioteca de jogadas táticas conhecidas, disponível pra
-- todos os clubes (atuais e futuros) como ponto de partida, sem precisar
-- recriar em cada conta. club_id null = jogada global (somente leitura pro
-- coach; a ALL policy existente de "coach manages plays" já exige
-- club_id = próprio clube, então não bate em linhas globais e elas ficam
-- protegidas de edição/exclusão automaticamente).
alter table plays alter column club_id drop not null;
alter table plays add column is_global boolean not null default false;
alter table plays add constraint plays_global_shape check (
  (is_global = false) or (is_global = true and club_id is null and target_type = 'team')
);

create policy "coach reads global plays" on plays for select
  using (is_global = true and (select role from my_profile()) = 'coach');

create policy "athlete reads global plays" on plays for select
  using (is_global = true and (select role from my_profile()) = 'athlete');
