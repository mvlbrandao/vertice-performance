import { describe, expect, it, vi } from "vitest";
import { createVitalsBatcher } from "./vitalsBatch";
import type { VitalReport } from "./vitalsShared";

const metrica = (name: VitalReport["name"], value: number, route = "/dashboard"): VitalReport => ({
  name,
  value,
  route,
});

function montar(hidden = false) {
  const enviados: VitalReport[][] = [];
  const agendadas: Array<() => void> = [];
  const estado = { hidden };
  const batcher = createVitalsBatcher({
    send: (reports) => enviados.push(reports),
    isHidden: () => estado.hidden,
    defer: (run) => agendadas.push(run),
  });
  return { batcher, enviados, agendadas, estado };
}

describe("createVitalsBatcher", () => {
  it("nada sai enquanto a página está visível; o flush manda tudo num ÚNICO envio", () => {
    const { batcher, enviados, agendadas } = montar();
    batcher.add(metrica("TTFB", 100));
    batcher.add(metrica("FCP", 500));
    batcher.add(metrica("LCP", 1800));
    expect(enviados).toHaveLength(0);
    expect(agendadas).toHaveLength(0);

    batcher.flush();
    expect(enviados).toHaveLength(1);
    expect(enviados[0].map((r) => r.name)).toEqual(["TTFB", "FCP", "LCP"]);
  });

  it("flush sem nada guardado não envia (idempotente)", () => {
    const { batcher, enviados } = montar();
    batcher.flush();
    batcher.add(metrica("LCP", 1));
    batcher.flush();
    batcher.flush();
    expect(enviados).toHaveLength(1);
  });

  it("a mesma métrica atualizada antes do flush sai uma vez, com o valor mais novo", () => {
    const { batcher, enviados } = montar();
    batcher.add(metrica("INP", 180));
    batcher.add(metrica("INP", 320));
    batcher.flush();
    expect(enviados[0]).toEqual([metrica("INP", 320)]);
  });

  it("TTFB, FCP e LCP saem uma vez por documento; INP e CLS saem de novo só se mudarem", () => {
    const { batcher, enviados } = montar();
    batcher.add(metrica("LCP", 1800));
    batcher.add(metrica("INP", 180));
    batcher.add(metrica("CLS", 0.05));
    batcher.flush();

    // A pessoa volta à aba e esconde de novo: LCP repetido não sai, INP igual não sai, CLS novo sai.
    batcher.add(metrica("LCP", 1800));
    batcher.add(metrica("INP", 180));
    batcher.add(metrica("CLS", 0.09));
    batcher.flush();

    expect(enviados.map((lote) => lote.map((r) => `${r.name}=${r.value}`))).toEqual([
      ["LCP=1800", "INP=180", "CLS=0.05"],
      ["CLS=0.09"],
    ]);
  });

  it("se tudo já foi enviado antes, o flush não faz envio vazio", () => {
    const { batcher, enviados } = montar();
    batcher.add(metrica("LCP", 1800));
    batcher.flush();
    batcher.add(metrica("LCP", 1800));
    batcher.flush();
    expect(enviados).toHaveLength(1);
  });

  it("métrica que chega com a página já escondida agenda UM flush para a próxima tarefa e junta as que vierem no mesmo evento", () => {
    const { batcher, enviados, agendadas } = montar(true);
    batcher.add(metrica("INP", 200));
    batcher.add(metrica("CLS", 0.02));
    batcher.add(metrica("LCP", 2000));

    // Nada sai dentro do evento; um único agendamento foi feito.
    expect(enviados).toHaveLength(0);
    expect(agendadas).toHaveLength(1);

    agendadas[0]();
    expect(enviados).toHaveLength(1);
    expect(enviados[0].map((r) => r.name).sort()).toEqual(["CLS", "INP", "LCP"]);
  });

  it("o agendado depois de um flush explícito não reenvia nada", () => {
    const { batcher, enviados, agendadas } = montar(true);
    batcher.add(metrica("INP", 200));
    batcher.flush(); // o gancho de visibilitychange em window rodou primeiro
    agendadas[0](); // e o setTimeout chega depois
    expect(enviados).toHaveLength(1);
  });

  it("depois de um flush, uma métrica nova escondida agenda de novo", () => {
    const { batcher, enviados, agendadas } = montar(true);
    batcher.add(metrica("INP", 200));
    agendadas[0]();
    batcher.add(metrica("CLS", 0.1));
    expect(agendadas).toHaveLength(2);
    agendadas[1]();
    expect(enviados).toHaveLength(2);
  });

  it("não agenda nada enquanto visível, e só consulta isHidden na chegada", () => {
    const send = vi.fn();
    const isHidden = vi.fn(() => false);
    const defer = vi.fn();
    const batcher = createVitalsBatcher({ send, isHidden, defer });
    batcher.add(metrica("TTFB", 80));
    expect(defer).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});
