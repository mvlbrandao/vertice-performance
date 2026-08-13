-- Conta Asaas por clube.
--
-- Até aqui existia uma chave só, no ambiente do servidor — a nossa. Com um
-- cliente isso passava, porque o clube era nosso. No segundo cliente vira
-- problema sério: a mensalidade que a mãe do atleta paga cairia na nossa
-- conta bancária, e nos tornaríamos intermediários do dinheiro dos outros,
-- com o peso fiscal e a responsabilidade que vêm junto.
--
-- Agora cada clube conecta a própria conta e o dinheiro vai direto pra quem
-- é de direito. Não confundir com clubs.asaas_customer_id/subscription_id,
-- que são o outro sentido: nós cobrando o clube pela plataforma.
alter table clubs add column asaas_api_key_encrypted text;
alter table clubs add column asaas_account_name text;
alter table clubs add column asaas_connected_at timestamptz;

-- Cada clube recebe o próprio endereço de webhook. Com uma rota única não
-- havia como saber de qual conta veio o evento — e aceitar evento sem saber
-- de quem é significa deixar qualquer um marcar cobrança como paga.
alter table clubs add column asaas_webhook_token text;
alter table clubs add constraint clubs_asaas_webhook_token_unique unique (asaas_webhook_token);

-- A chave nunca pode chegar ao navegador: ela move dinheiro. Só o servidor
-- lê, via service role. Nenhuma policy de select libera essas colunas — o
-- coach enxerga clubs pelas telas que já existem, então restringimos a
-- escrita e deixamos a leitura da credencial fora do alcance do RLS comum.
revoke select (asaas_api_key_encrypted) on clubs from anon, authenticated;
