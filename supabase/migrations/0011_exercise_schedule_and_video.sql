-- Data de quando o treino deve acontecer (pra entrar na linha do tempo
-- corretamente) e link de vídeo de referência anexado pelo treinador.
alter table exercises
  add column scheduled_date date not null default current_date,
  add column video_url text;
