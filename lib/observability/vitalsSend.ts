/**
 * Envio das métricas de UMA página ao servidor, num único corpo. Sem import de
 * Next nem de React, e com `navigator` e `fetch` injetáveis, para o teste
 * exercitar os dois caminhos (sendBeacon e fetch) em Node.
 *
 * Por que sendBeacon: as métricas finais (INP, CLS) só ficam prontas quando a
 * aba é escondida ou fechada, e é exatamente aí que um fetch comum é
 * cancelado. O beacon sobrevive ao descarregamento da página.
 *
 * Por que UM envio: cada requisição ao endpoint custa uma invocação de função,
 * uma ida ao Auth (o proxy valida a sessão e a rota valida de novo) e um
 * insert. Mandar as cinco métricas uma a uma multiplicava isso por cinco em
 * toda carga de página, de todo mundo que usa o sistema.
 *
 * Nunca lança e nunca espera resposta: telemetria não pode atrapalhar a tela.
 */
import { VITALS_ENDPOINT, type VitalReport, type VitalsBatch } from "@/lib/observability/vitalsShared";

export interface VitalsTransport {
  sendBeacon?: (url: string, data: Blob) => boolean;
  fetch?: (url: string, init: RequestInit) => Promise<unknown>;
}

export function sendVitalReports(
  reports: readonly VitalReport[],
  transport: VitalsTransport = {
    sendBeacon:
      typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function"
        ? navigator.sendBeacon.bind(navigator)
        : undefined,
    fetch: typeof fetch === "function" ? fetch.bind(globalThis) : undefined,
  },
): void {
  if (reports.length === 0) return;
  try {
    const batch: VitalsBatch = { metrics: [...reports] };
    const body = JSON.stringify(batch);

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
