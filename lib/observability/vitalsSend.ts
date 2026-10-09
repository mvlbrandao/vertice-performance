/**
 * Envio de um relatório de Web Vitals pelo navegador. Sem import de Next nem
 * de React, e com `navigator` e `fetch` injetáveis, para o teste exercitar os
 * dois caminhos (sendBeacon e fetch) em Node.
 *
 * Por que sendBeacon: as métricas finais (INP, CLS) só ficam prontas quando a
 * aba é escondida ou fechada, e é exatamente aí que um fetch comum é
 * cancelado. O beacon sobrevive ao descarregamento da página.
 *
 * Nunca lança e nunca espera resposta: telemetria não pode atrapalhar a tela.
 */
import { VITALS_ENDPOINT, type VitalReport } from "@/lib/observability/vitalsShared";

export interface VitalsTransport {
  sendBeacon?: (url: string, data: Blob) => boolean;
  fetch?: (url: string, init: RequestInit) => Promise<unknown>;
}

export function sendVitalReport(
  report: VitalReport,
  transport: VitalsTransport = {
    sendBeacon:
      typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function"
        ? navigator.sendBeacon.bind(navigator)
        : undefined,
    fetch: typeof fetch === "function" ? fetch.bind(globalThis) : undefined,
  },
): void {
  try {
    const body = JSON.stringify(report);

    // O Blob com tipo JSON faz o beacon sair como application/json; o servidor
    // lê o corpo como texto de qualquer jeito, mas o tipo correto evita surpresa.
    if (transport.sendBeacon) {
      let queued = false;
      try {
        queued = transport.sendBeacon(VITALS_ENDPOINT, new Blob([body], { type: "application/json" }));
      } catch {
        queued = false;
      }
      // false = o navegador recusou (fila cheia); cai no fetch.
      if (queued) return;
    }

    if (transport.fetch) {
      // keepalive: a requisição continua mesmo se a página for descarregada.
      void Promise.resolve(
        transport.fetch(VITALS_ENDPOINT, {
          method: "POST",
          body,
          keepalive: true,
          credentials: "same-origin",
          headers: { "content-type": "application/json" },
        }),
      ).catch(() => {});
    }
  } catch {
    // Silêncio de propósito: não há onde reportar uma falha de telemetria.
  }
}
