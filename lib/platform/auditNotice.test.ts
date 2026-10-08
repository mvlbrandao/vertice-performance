import { describe, expect, it } from "vitest";
import { AUDIT_NOT_RECORDED_WARNING, successResult } from "./auditNotice";

describe("successResult", () => {
  it("trilha gravada: sucesso limpo, sem aviso", () => {
    expect(successResult(true)).toEqual({ success: true });
  });

  it("trilha não gravada: sucesso COM aviso explícito, nunca silencioso", () => {
    const result = successResult(false);
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.warning).toBe(AUDIT_NOT_RECORDED_WARNING);
    expect(result.warning).toMatch(/NÃO foi registrada/);
  });
});
