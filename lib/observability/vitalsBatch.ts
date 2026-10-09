/**
 * Junta as métricas de uma página para sair num único envio. Sem React, sem
 * Next e sem `window`: o relógio, a visibilidade e o envio entram por
 * parâmetro, e o teste exercita a ordem dos eventos em Node.
 *
 * As métricas chegam em momentos diferentes (TTFB e FCP logo no carregamento;
 * LCP, INP e CLS só quando a página é escondida ou fechada). Em vez de uma
 * requisição por métrica, elas esperam aqui e saem juntas quando a página é
 * escondida. O que chega depois do envio (INP/CLS que mudaram) vai no seguinte.
 */
import { createVitalsDeduper, type VitalMetricName, type VitalReport } from "@/lib/observability/vitalsShared";

export interface VitalsBatcherDeps {
  send: (reports: VitalReport[]) => void;
  /** A página está escondida agora? */
  isHidden: () => boolean;
  /**
   * Executa depois do evento atual (setTimeout 0). Serve de rede de segurança
   * para métrica que chega com a página já escondida: várias chegam em
   * sequência dentro do mesmo evento, e esperar a próxima tarefa as junta.
   */
  defer: (run: () => void) => void;
}

export interface VitalsBatcher {
  /** Guarda a métrica (a mais recente de cada nome vence) até o próximo flush. */
  add(report: VitalReport): void;
  /** Envia o que está guardado e ainda não foi enviado, num único corpo. Idempotente. */
  flush(): void;
}

export function createVitalsBatcher(deps: VitalsBatcherDeps): VitalsBatcher {
  const pending = new Map<VitalMetricName, VitalReport>();
  // Reenvio é decidido na hora de enviar: um INP que mudou duas vezes antes do
  // flush sai uma vez só, com o valor final.
  const notYetSent = createVitalsDeduper();
  let deferred = false;

  function flush(): void {
    deferred = false;
    if (pending.size === 0) return;
    const reports = [...pending.values()].filter((report) => notYetSent(report.name, report.value));
    pending.clear();
    if (reports.length > 0) deps.send(reports);
  }

  return {
    add(report) {
      pending.set(report.name, report);
      // Página já escondida (ex.: aba aberta em segundo plano, ou métrica que
      // chega no meio do evento de esconder): ninguém vai disparar outro flush
      // por causa dela. Um só agendamento junta as que vierem no mesmo evento.
      if (deps.isHidden() && !deferred) {
        deferred = true;
        deps.defer(flush);
      }
    },
    flush,
  };
}
