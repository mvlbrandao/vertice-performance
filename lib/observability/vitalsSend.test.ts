import { describe, expect, it, vi } from "vitest";
import { sendVitalReports } from "./vitalsSend";
import { VITALS_ENDPOINT, type VitalReport } from "./vitalsShared";

const lcp: VitalReport = { name: "LCP", value: 1800, route: "/dashboard" };
const inp: VitalReport = { name: "INP", value: 120, route: "/dashboard" };
const lote = [lcp, inp];

async function textoDoBlob(blob: Blob) {
  return blob.text();
}

describe("sendVitalReports", () => {
  it("manda TODAS as métricas num único sendBeacon, com Blob JSON, sem chamar fetch", async () => {
    const sendBeacon = vi.fn(() => true);
    const fetchFn = vi.fn(async () => ({}));

    sendVitalReports(lote, { sendBeacon, fetch: fetchFn });

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [url, blob] = sendBeacon.mock.calls[0] as unknown as [string, Blob];
    expect(url).toBe(VITALS_ENDPOINT);
    expect(blob.type).toBe("application/json");
    expect(JSON.parse(await textoDoBlob(blob))).toEqual({ metrics: lote });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("cai no fetch com keepalive (ainda UM pedido só) quando o beacon recusa", () => {
    const fetchFn = vi.fn(async () => ({}));
    sendVitalReports(lote, { sendBeacon: () => false, fetch: fetchFn });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(VITALS_ENDPOINT);
    expect(init).toMatchObject({ method: "POST", keepalive: true, credentials: "same-origin" });
    expect(JSON.parse(init.body as string)).toEqual({ metrics: lote });
  });

  it("cai no fetch quando não há sendBeacon, ou quando ele lança", () => {
    const fetchFn = vi.fn(async () => ({}));
    sendVitalReports(lote, { fetch: fetchFn });
    sendVitalReports(lote, {
      sendBeacon: () => {
        throw new Error("indisponível");
      },
      fetch: fetchFn,
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("lista vazia não envia nada", () => {
    const sendBeacon = vi.fn(() => true);
    const fetchFn = vi.fn(async () => ({}));
    sendVitalReports([], { sendBeacon, fetch: fetchFn });
    expect(sendBeacon).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("o corpo de um envio completo cabe no teto de 2 KB do servidor", async () => {
    const completo: VitalReport[] = ["TTFB", "FCP", "LCP", "INP", "CLS"].map((name) => ({
      name: name as VitalReport["name"],
      value: 12345.67,
      route: `/${"a".repeat(60)}/:id/${"b".repeat(60)}`,
      navigationType: "back-forward-cache",
    }));
    const sendBeacon = vi.fn(() => true);
    sendVitalReports(completo, { sendBeacon });
    const [, blob] = sendBeacon.mock.calls[0] as unknown as [string, Blob];
    expect(blob.size).toBeLessThan(2_048);
  });

  it("nunca lança, nem com fetch que rejeita ou que lança", async () => {
    expect(() =>
      sendVitalReports(lote, { fetch: () => Promise.reject(new Error("offline")) }),
    ).not.toThrow();
    expect(() =>
      sendVitalReports(lote, {
        fetch: () => {
          throw new Error("síncrono");
        },
      }),
    ).not.toThrow();
    expect(() => sendVitalReports(lote, {})).not.toThrow();
    // Deixa a rejeição do primeiro caso ser consumida sem "unhandled rejection".
    await Promise.resolve();
  });
});
