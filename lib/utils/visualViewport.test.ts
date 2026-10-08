import { describe, it, expect } from "vitest";
import { keyboardInset, parseViewportBox } from "@/lib/utils/visualViewport";

const base = { layoutHeight: 800, visualHeight: 800, visualOffsetTop: 0, scale: 1 };

describe("keyboardInset", () => {
  it("sem teclado, devolve vazio e o CSS manda", () => {
    expect(keyboardInset(base)).toBe("");
  });

  it("com teclado aberto, devolve a altura visível e o deslocamento", () => {
    expect(keyboardInset({ ...base, visualHeight: 480, visualOffsetTop: 0 })).toBe("480|0");
  });

  it("guarda o deslocamento que o iOS aplica ao revelar o campo", () => {
    expect(keyboardInset({ ...base, visualHeight: 470.4, visualOffsetTop: 62.6 })).toBe("470|63");
  });

  it("barra do navegador aparecendo (diferença pequena) não conta como teclado", () => {
    expect(keyboardInset({ ...base, visualHeight: 740 })).toBe("");
  });

  it("zoom de pinça não é teclado", () => {
    expect(keyboardInset({ ...base, visualHeight: 400, scale: 2 })).toBe("");
  });
});

describe("parseViewportBox", () => {
  it("vazio vira null", () => {
    expect(parseViewportBox("")).toBeNull();
  });

  it("lê altura e deslocamento", () => {
    expect(parseViewportBox("480|63")).toEqual({ height: 480, offsetTop: 63 });
  });

  it("valor corrompido vira null em vez de NaN no estilo", () => {
    expect(parseViewportBox("abc|x")).toBeNull();
  });

  it("é inverso de keyboardInset", () => {
    const s = keyboardInset({ ...base, visualHeight: 500, visualOffsetTop: 10 });
    expect(parseViewportBox(s)).toEqual({ height: 500, offsetTop: 10 });
  });
});
