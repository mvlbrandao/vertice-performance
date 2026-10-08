/**
 * Limitador de janela fixa, em memória. PURO (o relógio entra por parâmetro
 * para o teste não depender do tempo real).
 *
 * Dois usos: impedir que uma falha em laço (um render que quebra a cada
 * requisição, um cron que reexecuta) grave milhares de linhas idênticas em
 * system_events, e limitar quantos Web Vitals um mesmo usuário pode enviar.
 *
 * Em memória de propósito: cada instância serverless tem o seu contador, então
 * o teto real é "N por instância", não "N no total". Para proteger o banco
 * contra inundação isso basta, e evita uma ida ao banco para decidir se vale
 * a pena ir ao banco. Ao esfriar a instância o contador some e tudo bem.
 */

export interface RateLimiter {
  /** true = pode seguir; false = estourou o limite desta chave na janela atual. */
  allow(key: string, now?: number): boolean;
}

export interface RateLimiterOptions {
  /** Quantas permissões por chave dentro de uma janela. */
  max: number;
  windowMs: number;
  /**
   * Teto de chaves guardadas, para a memória não crescer sem limite quando as
   * chaves são imprevisíveis (impressões digitais de erro, ids de usuário).
   * Passou disso: descarta as janelas vencidas e, se ainda assim estiver cheio,
   * recomeça do zero. Recomeçar libera um pouco além do limite uma vez, o que
   * é preferível a reter memória sem fim.
   */
  maxKeys?: number;
}

export function createRateLimiter({ max, windowMs, maxKeys = 1_000 }: RateLimiterOptions): RateLimiter {
  const buckets = new Map<string, { start: number; count: number }>();

  function purge(now: number) {
    for (const [key, bucket] of buckets) {
      if (now - bucket.start >= windowMs) buckets.delete(key);
    }
    if (buckets.size >= maxKeys) buckets.clear();
  }

  return {
    allow(key, now = Date.now()) {
      const bucket = buckets.get(key);

      if (!bucket || now - bucket.start >= windowMs) {
        if (!bucket && buckets.size >= maxKeys) purge(now);
        buckets.set(key, { start: now, count: 1 });
        return max >= 1;
      }

      if (bucket.count >= max) return false;
      bucket.count += 1;
      return true;
    },
  };
}
