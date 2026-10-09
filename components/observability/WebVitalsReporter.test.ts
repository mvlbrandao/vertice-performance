import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const capturado = vi.hoisted(() => ({ callback: null as null | ((metric: unknown) => void), registros: 0 }));

vi.mock("next/web-vitals", () => ({
  useReportWebVitals: (fn: (metric: unknown) => void) => {
    capturado.callback = fn;
    capturado.registros += 1;
  },
}));

type Ouvinte = () => void;

/**
 * Modelo mínimo do que importa na ordem dos eventos: `visibilitychange` é
 * disparado em `document` e sobe até `window` (os ouvintes de document rodam
 * primeiro); `pagehide` é disparado em `window`.
 */
function criarAmbiente() {
  const emDocument = new Map<string, Ouvinte[]>();
  const emWindow = new Map<string, Ouvinte[]>();
  const adicionar = (mapa: Map<string, Ouvinte[]>) => (tipo: string, fn: Ouvinte) => {
    mapa.set(tipo, [...(mapa.get(tipo) ?? []), fn]);
  };

  const documento = { visibilityState: "visible", addEventListener: adicionar(emDocument) };
  const janela = { location: { pathname: "/admin/clubes/42" }, addEventListener: adicionar(emWindow) };

  return {
    documento,
    janela,
    /** Ouvinte que a biblioteca de web-vitals registra em `document` (a ordem de registro é do teste). */
    ouvirNoDocument: adicionar(emDocument),
    esconder() {
      documento.visibilityState = "hidden";
      for (const fn of emDocument.get("visibilitychange") ?? []) fn();
      for (const fn of emWindow.get("visibilitychange") ?? []) fn();
    },
    mostrar() {
      documento.visibilityState = "visible";
      for (const fn of emDocument.get("visibilitychange") ?? []) fn();
      for (const fn of emWindow.get("visibilitychange") ?? []) fn();
    },
    descarregar() {
      for (const fn of emWindow.get("pagehide") ?? []) fn();
    },
    totalDeOuvintesEmWindow: () => [...emWindow.values()].reduce((soma, lista) => soma + lista.length, 0),
  };
}

let ambiente: ReturnType<typeof criarAmbiente>;
const enviados: Array<{ url: string; corpo: Promise<string> }> = [];

// Função à parte: o TypeScript estreita `capturado.callback` para `null` depois
// da atribuição e não enxerga que o componente o preenche.
function callbackRegistrado() {
  return capturado.callback;
}

async function carregar(taxa?: string) {
  vi.resetModules();
  if (taxa !== undefined) vi.stubEnv("NEXT_PUBLIC_VITALS_SAMPLE_RATE", taxa);
  capturado.callback = null;
  const { WebVitalsReporter } = await import("./WebVitalsReporter");
  // Os hooks do React não rodam fora de um render, mas aqui o hook é o mock acima.
  WebVitalsReporter();
  const callback = callbackRegistrado();
  if (!callback) throw new Error("o componente não registrou o callback");
  return callback;
}

const metrica = (name: string, value: number, extra: Record<string, unknown> = {}) => ({
  name,
  value,
  rating: "good",
  navigationType: "navigate",
  ...extra,
});

async function corposEnviados() {
  return Promise.all(enviados.map((e) => e.corpo.then((texto) => JSON.parse(texto) as { metrics: Array<Record<string, unknown>> })));
}

beforeEach(() => {
  enviados.length = 0;
  ambiente = criarAmbiente();
  vi.stubGlobal("window", ambiente.janela);
  vi.stubGlobal("document", ambiente.documento);
  vi.stubGlobal("performance", {
    getEntriesByType: () => [{ name: "https://vertice.app/login?next=%2Fadmin" }],
  });
  vi.stubGlobal("navigator", {
    sendBeacon: (url: string, blob: Blob) => {
      enviados.push({ url, corpo: blob.text() });
      return true;
    },
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("WebVitalsReporter", () => {
  it("registra um callback ESTÁVEL no useReportWebVitals (mesma referência a cada renderização)", async () => {
    const primeiro = await carregar();
    const { WebVitalsReporter } = await import("./WebVitalsReporter");
    WebVitalsReporter();
    expect(callbackRegistrado()).toBe(primeiro);
  });

  it("não renderiza nada", async () => {
    await carregar();
    const { WebVitalsReporter } = await import("./WebVitalsReporter");
    expect(WebVitalsReporter()).toBeNull();
  });

  it("as métricas esperam: nada é enviado enquanto a página está visível", async () => {
    const reportar = await carregar();
    reportar(metrica("TTFB", 120));
    reportar(metrica("FCP", 800));
    expect(enviados).toHaveLength(0);
  });

  it("voltar a ficar visível não envia: só esconder ou descarregar fecha o lote", async () => {
    const reportar = await carregar();
    reportar(metrica("TTFB", 120));
    ambiente.mostrar();
    expect(enviados).toHaveLength(0);
    ambiente.esconder();
    expect(enviados).toHaveLength(1);
  });

  it("ao esconder a página, TODAS as métricas saem num único beacon para /api/telemetry/vitals", async () => {
    const reportar = await carregar();
    reportar(metrica("TTFB", 120));
    reportar(metrica("FCP", 800));
    reportar(metrica("LCP", 2100.456));
    reportar(metrica("INP", 180));
    reportar(metrica("CLS", 0.05));

    ambiente.esconder();

    expect(enviados).toHaveLength(1);
    expect(enviados[0].url).toBe("/api/telemetry/vitals");
    const [corpo] = await corposEnviados();
    expect(corpo.metrics.map((m) => m.name)).toEqual(["TTFB", "FCP", "LCP", "INP", "CLS"]);
    expect(corpo.metrics.find((m) => m.name === "LCP")?.value).toBe(2100.46);
    // A nota do navegador não viaja: o servidor a recalcula.
    expect(JSON.stringify(corpo)).not.toContain("rating");
  });

  it("LCP usa a página do carregamento; INP e CLS, a rota de agora", async () => {
    const reportar = await carregar();
    reportar(metrica("LCP", 2100));
    reportar(metrica("INP", 180));
    ambiente.esconder();

    const [corpo] = await corposEnviados();
    expect(corpo.metrics.find((m) => m.name === "LCP")?.route).toBe("/login");
    expect(corpo.metrics.find((m) => m.name === "INP")?.route).toBe("/admin/clubes/42");
  });

  it("ORDEM DOS EVENTOS: métricas que a biblioteca entrega no próprio visibilitychange entram no mesmo lote, mesmo se o ouvinte dela nasceu DEPOIS do nosso", async () => {
    const reportar = await carregar();
    // Só TTFB chegou até aqui; nosso ouvinte (em window) já foi registrado por ele.
    reportar(metrica("TTFB", 100));

    // O CLS da biblioteca só registra o ouvinte dele depois do FCP, ou seja, depois do nosso.
    ambiente.ouvirNoDocument("visibilitychange", () => {
      reportar(metrica("INP", 190));
      reportar(metrica("CLS", 0.04));
      reportar(metrica("LCP", 1900));
    });

    ambiente.esconder();

    expect(enviados).toHaveLength(1);
    const [corpo] = await corposEnviados();
    expect(corpo.metrics.map((m) => m.name).sort()).toEqual(["CLS", "INP", "LCP", "TTFB"]);
  });

  it("fechar a aba sem visibilitychange: o pagehide manda o que estiver guardado", async () => {
    const reportar = await carregar();
    reportar(metrica("TTFB", 100));
    ambiente.descarregar();
    expect(enviados).toHaveLength(1);
  });

  it("aba que já nasce escondida: a métrica que chega sai sozinha na tarefa seguinte, num envio só", async () => {
    vi.useFakeTimers();
    const reportar = await carregar();
    ambiente.documento.visibilityState = "hidden";
    reportar(metrica("TTFB", 100));
    reportar(metrica("FCP", 300));
    expect(enviados).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(0);
    expect(enviados).toHaveLength(1);
    expect((await corposEnviados())[0].metrics.map((m) => m.name)).toEqual(["TTFB", "FCP"]);
  });

  it("depois de enviado, esconder de novo não repete: carga única por documento; INP/CLS só se mudarem", async () => {
    const reportar = await carregar();
    reportar(metrica("TTFB", 120));
    reportar(metrica("CLS", 0.05));
    ambiente.esconder();
    ambiente.mostrar();

    // Remontagem do AppShell: a biblioteca reentrega o que já mediu.
    reportar(metrica("TTFB", 120));
    reportar(metrica("CLS", 0.05));
    ambiente.esconder();
    expect(enviados).toHaveLength(1);

    // Mas o CLS mudou durante o uso: sai o novo valor.
    ambiente.mostrar();
    reportar(metrica("CLS", 0.12));
    ambiente.esconder();
    expect(enviados).toHaveLength(2);
    expect((await corposEnviados())[1].metrics).toMatchObject([{ name: "CLS", value: 0.12 }]);
  });

  it("ignora FID e métricas internas do Next", async () => {
    const reportar = await carregar();
    reportar(metrica("FID", 10));
    reportar(metrica("Next.js-hydration", 10));
    ambiente.esconder();
    expect(enviados).toHaveLength(0);
  });

  it("taxa 0 não envia nada nem registra ouvinte; taxa inválida mede todo mundo", async () => {
    const zero = await carregar("0");
    zero(metrica("LCP", 1000));
    ambiente.esconder();
    expect(enviados).toHaveLength(0);
    expect(ambiente.totalDeOuvintesEmWindow()).toBe(0);

    const invalida = await carregar("abc");
    invalida(metrica("LCP", 1000));
    ambiente.esconder();
    expect(enviados).toHaveLength(1);
  });

  it("o sorteio vale para o carregamento inteiro, não por métrica", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    const reportar = await carregar("0.5");
    reportar(metrica("LCP", 1000));
    reportar(metrica("FCP", 500));
    reportar(metrica("TTFB", 100));
    ambiente.esconder();
    expect(enviados).toHaveLength(0);
  });

  it("registra os ouvintes de saída uma vez só, por mais métricas que cheguem", async () => {
    const reportar = await carregar();
    reportar(metrica("TTFB", 100));
    reportar(metrica("FCP", 200));
    reportar(metrica("LCP", 300));
    // visibilitychange + pagehide
    expect(ambiente.totalDeOuvintesEmWindow()).toBe(2);
  });

  it("nunca lança, nem sem window ou com métrica quebrada", async () => {
    const reportar = await carregar();
    vi.unstubAllGlobals();
    expect(() => reportar(metrica("LCP", 1000))).not.toThrow();
    expect(() => reportar(null)).not.toThrow();
    expect(() => reportar(undefined)).not.toThrow();
  });
});
