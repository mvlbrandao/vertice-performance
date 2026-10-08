import { describe, expect, it } from "vitest";
import { auditHref, escapeLike, isExactAction, parseAuditFilters } from "./auditQuery";

const UUID = "3f2b1c9e-8a47-4d1e-9c55-0a1b2c3d4e5f";

describe("parseAuditFilters", () => {
  it("sem parâmetros: tudo nulo", () => {
    expect(parseAuditFilters({})).toEqual({ action: null, clubId: null, before: null });
  });

  it("aceita entidade (prefixo) e ação exata", () => {
    expect(parseAuditFilters({ acao: "club" }).action).toBe("club");
    expect(parseAuditFilters({ acao: "club.set_status" }).action).toBe("club.set_status");
  });

  it("recusa ação com caracteres de LIKE, aspas ou espaço", () => {
    for (const ruim of ["club%", "club.%", "a b", "club'; --", "Club", "a.b.c", "", ".x", "x."]) {
      expect(parseAuditFilters({ acao: ruim }).action, ruim).toBeNull();
    }
  });

  it("aceita só UUID como clube", () => {
    expect(parseAuditFilters({ clube: UUID }).clubId).toBe(UUID);
    expect(parseAuditFilters({ clube: UUID.toUpperCase() }).clubId).toBe(UUID);
    expect(parseAuditFilters({ clube: "1 or 1=1" }).clubId).toBeNull();
    expect(parseAuditFilters({ clube: "abc" }).clubId).toBeNull();
  });

  it("aceita o cursor no formato do PostgREST, com microssegundos", () => {
    const cursor = "2026-10-08T15:00:00.123456+00:00";
    expect(parseAuditFilters({ antes: cursor }).before).toBe(cursor);
    expect(parseAuditFilters({ antes: "2026-10-08T15:00:00Z" }).before).toBe("2026-10-08T15:00:00Z");
  });

  it("recusa cursor que não é data", () => {
    expect(parseAuditFilters({ antes: "ontem" }).before).toBeNull();
    expect(parseAuditFilters({ antes: "2026-13-45T99:99:99Z" }).before).toBeNull();
    expect(parseAuditFilters({ antes: "2026-10-08" }).before).toBeNull();
    expect(parseAuditFilters({ antes: "2026-10-08T15:00:00Z,or=(id.gt.0)" }).before).toBeNull();
  });

  it("usa o primeiro valor de parâmetro repetido", () => {
    expect(parseAuditFilters({ acao: ["club", "settings"] }).action).toBe("club");
  });
});

describe("isExactAction", () => {
  it("distingue ação completa de prefixo", () => {
    expect(isExactAction("club.set_status")).toBe(true);
    expect(isExactAction("club")).toBe(false);
  });
});

describe("escapeLike", () => {
  it("escapa curingas e a própria barra", () => {
    expect(escapeLike("club_x")).toBe("club\\_x");
    expect(escapeLike("100%")).toBe("100\\%");
    expect(escapeLike("a\\b")).toBe("a\\\\b");
    expect(escapeLike("club")).toBe("club");
  });
});

describe("auditHref", () => {
  it("sem filtros é a tela limpa", () => {
    expect(auditHref({})).toBe("/admin/auditoria");
    expect(auditHref({ action: null, clubId: null, before: null })).toBe("/admin/auditoria");
  });

  it("monta a query só com o que existe", () => {
    expect(auditHref({ action: "club", clubId: UUID })).toBe(
      `/admin/auditoria?acao=club&clube=${UUID}`,
    );
  });

  it("codifica o + do fuso do cursor, que viraria espaço na URL", () => {
    const href = auditHref({ before: "2026-10-08T15:00:00.123456+00:00" });
    expect(href).toContain("%2B00%3A00");
    expect(href).not.toContain("+00");
    const back = new URL(href, "http://x").searchParams.get("antes");
    expect(back).toBe("2026-10-08T15:00:00.123456+00:00");
  });
});
