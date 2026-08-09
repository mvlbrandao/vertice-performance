-- Fundação de permissões: profissionais externos (treinador de específicos,
-- preparador físico etc.) que não são o treinador dono do clube. Adiciona o
-- papel 'staff' ao enum e um campo de função/título pra exibição.
alter type user_role add value 'staff';

alter table profiles add column title text;
