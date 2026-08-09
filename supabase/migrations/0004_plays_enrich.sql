-- Enriquece a tabela `plays` (Mesa Tática) para suportar edição e um link
-- de vídeo de referência por jogada.
alter table plays
  add column video_url text,
  add column description text,
  add column updated_at timestamptz not null default now();
