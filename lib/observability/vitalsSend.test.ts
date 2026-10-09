import { describe, expect, it, vi } from "vitest";
import { sendVitalReport } from "./vitalsSend";
import { VITALS_ENDPOINT, type VitalReport } from "./vitalsShared";

const relatorio: VitalReport = { name: "LCP", value: 1800, rating: "good", route: "/dashboard" };

async function textoDoBlob(blob: Blob) {
  return blob.text();
}

describe("sendVitalReport", () => {
  it("usa sendBeacon com Blob JSON e não chama fetch quando o navegador aceita", async () => {
    const sendBeacon = vi.fn(() => true);
    const fetchFn = vi.fn(async () => ({}));

    sendVitalReport(relatorio, { sendBeacon, fetch: fetchFn });

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const [url, blob] = sendBeacon.mock.calls[0] as unknown as [string, Blob];
    expect(url).toBe(VITALS_ENDPOINT);
    expect(blob.type).toBe("application/json");
    expect(JSON.parse(await textoDoBlob(blob))).toEqual(relatorio);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("cai no fetch com keepalive quando o beacon recusa (retorna false)", () => {
    const fetchFn = vi.fn(async () => ({}));
    sendVitalReport(relatorio, { sendBeacon: () => false, fetch: fetchFn });

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(VITALS_ENDPOINT);
    expect(init).toMatchObject({ method: "POST", keepalive: true, credentials: "same-origin" });
    expect(JSON.parse(init.body as string)).toEqual(relatorio);
  });

  it("cai no fetch quando não há sendBeacon, ou quando ele lança", () => {
    const fetchFn = vi.fn(async () => ({}));
    sendVitalReport(relatorio, { fetch: fetchFn });
    sendVitalReport(relatorio, {
      sendBeacon: () => {
        throw new Error("indisponível");
      },
      fetch: fetchFn,
    });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("nunca lança, nem com fetch que rejeita ou que lança", async () => {
    expect(() =>
      sendVitalReport(relatorio, { fetch: () => Promise.reject(new Error("offline")) }),
    ).not.toThrow();
    expect(() =>
      sendVitalReport(relatorio, {
        fetch: () => {
          throw new Error("síncrono");
        },
      }),
    ).not.toThrow();
    expect(() => sendVitalReport(relatorio, {})).not.toThrow();
    // Deixa a rejeição do primeiro caso ser consumida sem "unhandled rejection".
    await Promise.resolve();
  });
});
