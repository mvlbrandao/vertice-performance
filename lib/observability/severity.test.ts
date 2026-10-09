import { describe, expect, it } from "vitest";
import { classifySeverity } from "./severity";

describe("classifySeverity", () => {
  it("erro comum é error (na dúvida, error)", () => {
    expect(classifySeverity({ message: "Cannot read properties of undefined (reading 'id')" })).toBe("error");
    expect(classifySeverity({ message: "" })).toBe("error");
  });

  it("resposta 4xx é warn; 5xx e ausência de status são error", () => {
    expect(classifySeverity({ message: "x", statusCode: 404 })).toBe("warn");
    expect(classifySeverity({ message: "x", statusCode: 400 })).toBe("warn");
    expect(classifySeverity({ message: "x", statusCode: 499 })).toBe("warn");
    expect(classifySeverity({ message: "x", statusCode: 500 })).toBe("error");
    expect(classifySeverity({ message: "x", statusCode: 399 })).toBe("error");
    expect(classifySeverity({ message: "x", statusCode: null })).toBe("error");
  });

  it("ação de um deploy antigo e cliente que desistiu são warn", () => {
    expect(classifySeverity({ message: "Failed to find Server Action \"abc\". This request might be from an older or newer deployment." })).toBe("warn");
    expect(classifySeverity({ message: "read ECONNRESET" })).toBe("warn");
    expect(classifySeverity({ message: "The operation was aborted" })).toBe("warn");
    expect(classifySeverity({ message: "AbortError: signal" })).toBe("warn");
    expect(classifySeverity({ message: "socket hang up" })).toBe("warn");
  });
});
