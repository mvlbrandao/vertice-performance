import { afterEach, describe, expect, it, vi } from "vitest";
import { TimeoutError, withTimeout } from "./timeout";

afterEach(() => vi.useRealTimers());

describe("withTimeout", () => {
  it("devolve o valor quando a operação termina a tempo", async () => {
    await expect(withTimeout(Promise.resolve(7), 100)).resolves.toBe(7);
  });

  it("repassa a rejeição original", async () => {
    await expect(withTimeout(Promise.reject(new Error("falhou")), 100)).rejects.toThrow("falhou");
  });

  it("rejeita com TimeoutError quando estoura o prazo", async () => {
    vi.useFakeTimers();
    const nunca = new Promise<never>(() => {});
    const resultado = withTimeout(nunca, 2_000, "gravação de evento");
    const verificada = expect(resultado).rejects.toMatchObject({
      name: "TimeoutError",
      message: "gravação de evento excedeu 2000 ms",
    });
    await vi.advanceTimersByTimeAsync(2_000);
    await verificada;
    expect(new TimeoutError("x", 1)).toBeInstanceOf(Error);
  });

  it("não deixa temporizador pendurado quando a operação termina antes", async () => {
    vi.useFakeTimers();
    await withTimeout(Promise.resolve(1), 5_000);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aceita um PromiseLike (como o builder do Supabase)", async () => {
    const thenable: PromiseLike<number> = {
      then: (ok) => Promise.resolve(5).then(ok),
    };
    await expect(withTimeout(thenable, 100)).resolves.toBe(5);
  });
});
