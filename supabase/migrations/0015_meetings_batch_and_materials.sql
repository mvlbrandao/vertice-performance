-- Agendamento em lote (time inteiro) e materiais de preparo (mesa tática / vídeo)
-- anexados a um encontro.
alter table meetings add column batch_id uuid;
alter table meetings add column play_id uuid references plays(id) on delete set null;
alter table meetings add column material_video_url text;

create index on meetings (batch_id);
