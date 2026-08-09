-- Nem todo clube no diretório é gerido pelo treinador — muitos são só
-- adversários/referência pra jogos e cadastro de atleta. Adiciona um toggle
-- pra marcar quais estão de fato sob a gestão do treinador (afeta só o
-- selo "Sob sua gestão"; não restringe uso do clube em outros cadastros).
alter table partner_clubs add column is_managed boolean not null default true;
