-- Amplia o vocabulário de eventos da súmula com lances defensivos, de bola
-- parada e de passe, além de gol/cartão/lesão/pênalti já existentes.
alter table game_events drop constraint game_events_event_type_check;
alter table game_events add constraint game_events_event_type_check check (event_type in (
  'Gol',
  'Assistência',
  'Falta',
  'Cartão amarelo',
  'Cartão vermelho',
  'Lesão',
  'Pênalti sofrido',
  'Pênalti perdido',
  'Pênalti defendido',
  'Escanteio',
  'Lateral',
  'Desarme',
  'Interceptação',
  'Cruzamento',
  'Finalização certa',
  'Finalização errada',
  'Impedimento',
  'Defesa',
  'Passe certo',
  'Passe errado'
));
