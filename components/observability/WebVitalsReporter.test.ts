import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const capturado = vi.hoisted(() => ({ callback: null as null | ((metric: unknown) => void), registros: 0 }));

vi.mock("next/web-vitals", () => ({
  useReportWebVitals: (fn: (metric: unknown) => void) => {
    capturado.callback = fn;
    capturado.registros += 1;
  },
}));

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

beforeEach(() => {
  enviados.length = 0;
  vi.stubGlobal("window", { location: { pathname: "/admin/clubes/42" } });
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
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
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

  it("envia por sendBeacon para /api/telemetry/vitals; LCP usa a página do carregamento, INP a rota de agora", async () => {
    const reportar = await carregar();
    reportar(metrica("LCP", 2100.456));
    reportar(metrica("INP", 180));

    expect(enviados).toHaveLength(2);
    expect(enviados.every((e) => e.url === "/api/telemetry/vitals")).toBe(true);
    expect(JSON.parse(await enviados[0].corpo)).toEqual({
      name: "LCP",
      value: 2100.46,
      rating: "good",
      route: "/login",
      navigationType: "navigate",
    });
    expect(JSON.parse(await enviados[1].corpo)).toMatchObject({ name: "INP", route: "/admin/clubes/42" });
  });

  it("ignora FID e métricas internas do Next", async () => {
    const reportar = await carregar();
    reportar(metrica("FID", 10));
    reportar(metrica("Next.js-hydration", 10));
    expect(enviados).toHaveLength(0);
  });

  it("não reenvia o que já mediu (remontagem do AppShell)", async () => {
    const reportar = await carregar();
    reportar(metrica("TTFB", 120));
    reportar(metrica("TTFB", 120));
    reportar(metrica("CLS", 0.05));
    reportar(metrica("CLS", 0.05));
    expect(enviados).toHaveLength(2);
  });

  it("taxa 0 não envia nada; taxa inválida mede todo mundo", async () => {
    const zero = await carregar("0");
    zero(metrica("LCP", 1000));
    expect(enviados).toHaveLength(0);

    const invalida = await carregar("abc");
    invalida(metrica("LCP", 1000));
    expect(enviados).toHaveLength(1);
  });

  it("o sorteio vale para o carregamento inteiro, não por métrica", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9);
    const reportar = await carregar("0.5");
    reportar(metrica("LCP", 1000));
    reportar(metrica("FCP", 500));
    reportar(metrica("TTFB", 100));
    expect(enviados).toHaveLength(0);
    vi.restoreAllMocks();
  });

  it("nunca lança, nem sem window ou com métrica quebrada", async () => {
    const reportar = await carregar();
    vi.unstubAllGlobals();
    expect(() => reportar(metrica("LCP", 1000))).not.toThrow();
    expect(() => reportar(null)).not.toThrow();
    expect(() => reportar(undefined)).not.toThrow();
  });
});
