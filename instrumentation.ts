import type { Instrumentation } from "next";

/**
 * Captura de erros do servidor para a tela /admin/saude.
 *
 * Só o runtime Node grava: o módulo de registro usa o client de service role
 * e node:crypto, que não existem no Edge. A comparação com NEXT_RUNTIME
 * precisa ficar assim, literal e envolvendo o import, para o bundler do Edge
 * descartar o ramo em vez de tentar empacotar o módulo.
 *
 * O Next manda para cá tudo que dá errado SEM tratamento: render, rota,
 * server action, proxy. Redirecionamentos e notFound() também chegam como
 * exceção e são filtrados lá dentro. O gancho nunca rejeita (ver
 * handleRequestError): registrar não pode mudar o resultado do pedido.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { handleRequestError } = await import("./lib/observability/onRequestError");
      await handleRequestError(error, request, context);
    } catch {
      // Falha ao carregar ou gravar não pode virar um segundo erro.
    }
  }
};
