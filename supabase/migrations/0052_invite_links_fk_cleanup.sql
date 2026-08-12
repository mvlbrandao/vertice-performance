-- As duas referências a profiles ficaram sem ação de exclusão, então o
-- banco passou a barrar a remoção de qualquer conta que tivesse tocado
-- num convite. Apareceu ao apagar uma conta criada por link em teste: o
-- delete falhou com violação de invite_links_used_by_fkey.
--
-- used_by vira null: o convite continua registrado como usado (used_at
-- preservado), só perde o vínculo com a conta que não existe mais.
-- created_by cascateia: convite sem quem o criou não serve pra nada.
alter table invite_links drop constraint invite_links_used_by_fkey;
alter table invite_links
  add constraint invite_links_used_by_fkey
  foreign key (used_by) references profiles(id) on delete set null;

alter table invite_links drop constraint invite_links_created_by_fkey;
alter table invite_links
  add constraint invite_links_created_by_fkey
  foreign key (created_by) references profiles(id) on delete cascade;
