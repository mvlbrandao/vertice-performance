import { describe, expect, it } from "vitest";
import {
  AUDIT_ACTION_LABELS,
  auditActionLabel,
  auditEntityOf,
  auditFieldLabel,
  describeAuditDetails,
  formatAuditDate,
  formatAuditTime,
  formatAuditValue,
  isValidAuditAction,
} from "./auditLabels";

// Intl usa espaço não separável entre "R$" e o número.
const plain = (s: string) => s.replace(/\s/g, " ");

describe("isValidAuditAction", () => {
  it("aceita o formato entidade.verbo da restrição do banco", () => {
    expect(isValidAuditAction("club.extend_trial")).toBe(true);
    expect(isValidAuditAction("settings.update")).toBe(true);
  });

  it("recusa o que o banco recusaria", () => {
    expect(isValidAuditAction("club")).toBe(false);
    expect(isValidAuditAction("Club.Update")).toBe(false);
    expect(isValidAuditAction("club.update.now")).toBe(false);
    expect(isValidAuditAction("club.update2")).toBe(false);
    expect(isValidAuditAction("")).toBe(false);
    expect(isValidAuditAction(null)).toBe(false);
  });
});

describe("auditActionLabel", () => {
  it("tem rótulo em português para as nove ações do painel", () => {
    const acoes = [
      "settings.update",
      "club.extend_trial",
      "club.grant_courtesy",
      "club.revoke_courtesy",
      "club.reset_payment_promise",
      "club.set_overrides",
      "club.set_status",
      "club.start_subscription",
      "club.cancel_subscription",
    ];
    for (const acao of acoes) {
      expect(AUDIT_ACTION_LABELS[acao], acao).toBeTruthy();
      expect(auditActionLabel(acao)).not.toBe(acao);
    }
  });

  it("ação desconhecida aparece com o código cru, sem quebrar", () => {
    expect(auditActionLabel("club.acao_inexistente")).toBe("club.acao_inexistente");
  });

  it("extrai a entidade da ação", () => {
    expect(auditEntityOf("club.set_status")).toBe("club");
    expect(auditEntityOf("settings.update")).toBe("settings");
  });
});

describe("auditFieldLabel", () => {
  it("traduz campos conhecidos e humaniza os demais", () => {
    expect(auditFieldLabel("price_cents_override")).toBe("Preço próprio");
    expect(auditFieldLabel("campo_novo_qualquer")).toBe("campo novo qualquer");
  });
});

describe("formatAuditTime", () => {
  it("converte UTC para o horário de Brasília", () => {
    expect(formatAuditTime("2026-10-08T15:00:00Z")).toBe("08/10/2026 12:00:00");
  });

  it("passa da meia-noite para o dia anterior no fuso certo", () => {
    expect(formatAuditTime("2026-10-08T02:30:00Z")).toBe("07/10/2026 23:30:00");
  });

  it("meia-noite local sai como 00, não 24", () => {
    expect(formatAuditTime("2026-10-08T03:00:00Z")).toBe("08/10/2026 00:00:00");
  });

  it("aceita o formato com microssegundos e offset do Postgres", () => {
    expect(formatAuditTime("2026-10-08T15:00:00.123456+00:00")).toBe("08/10/2026 12:00:00");
  });

  it("devolve o texto original quando não é uma data", () => {
    expect(formatAuditTime("ontem")).toBe("ontem");
  });
});

describe("formatAuditDate", () => {
  it("usa o dia civil de Brasília", () => {
    expect(formatAuditDate("2026-10-31T23:59:59Z")).toBe("31/10/2026");
  });
});

describe("formatAuditValue", () => {
  it("formata centavos como reais", () => {
    expect(plain(formatAuditValue("price_cents", 14990))).toBe("R$ 149,90");
    expect(plain(formatAuditValue("price_cents_override", 0))).toBe("R$ 0,00");
  });

  it("mostra vazio como travessão", () => {
    expect(formatAuditValue("courtesy_until", null)).toBe("—");
    expect(formatAuditValue("courtesy_reason", "")).toBe("—");
    expect(formatAuditValue("x", undefined)).toBe("—");
  });

  it("traduz a situação do clube", () => {
    expect(formatAuditValue("status", "trial")).toBe("Em teste");
    expect(formatAuditValue("status", "bloqueado")).toBe("Bloqueado");
    expect(formatAuditValue("status", "outra")).toBe("outra");
  });

  it("prazos de fim de dia mostram só a data; demais instantes mostram a hora", () => {
    expect(formatAuditValue("trial_ends_at", "2026-10-31T23:59:59Z")).toBe("31/10/2026");
    expect(formatAuditValue("canceled_at", "2026-10-08T15:00:00Z")).toBe("08/10/2026 12:00:00");
  });

  it("booleano vira Sim/Não e número solto fica como número", () => {
    expect(formatAuditValue("x", true)).toBe("Sim");
    expect(formatAuditValue("x", false)).toBe("Não");
    expect(formatAuditValue("max_athletes", 30)).toBe("30");
  });

  it("traduz forma de cobrança e retorno do Asaas", () => {
    expect(formatAuditValue("billing_type", "CREDIT_CARD")).toBe("Cartão");
    expect(formatAuditValue("asaas", "nao_encontrada")).toBe("Já não existia no Asaas");
  });
});

describe("describeAuditDetails", () => {
  it("transforma mudanças em linhas de -> para", () => {
    const lines = describeAuditDetails({
      changes: {
        status: { from: "trial", to: "ativo" },
        price_cents_override: { from: null, to: 9900 },
      },
    });
    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({ label: "Situação", from: "Em teste", to: "Ativo" });
    expect(lines[1].label).toBe("Preço próprio");
    expect(lines[1].from).toBe("—");
    expect(plain(lines[1].to ?? "")).toBe("R$ 99,00");
  });

  it("mantém fatos soltos ao lado das mudanças", () => {
    const lines = describeAuditDetails({
      dias: 15,
      changes: { status: { from: "trial", to: "trial" } },
    });
    expect(lines.map((l) => l.label)).toEqual(["Situação", "Dias adicionados"]);
    expect(lines[1].value).toBe("15");
  });

  it("não repete a chave changes como fato solto", () => {
    const lines = describeAuditDetails({ changes: { status: { from: "a", to: "b" } } });
    expect(lines.some((l) => l.label === "changes")).toBe(false);
  });

  it("tolera detalhes vazios, nulos e de formato inesperado", () => {
    expect(describeAuditDetails(null)).toEqual([]);
    expect(describeAuditDetails(undefined)).toEqual([]);
    expect(describeAuditDetails({})).toEqual([]);
    expect(describeAuditDetails("texto")).toEqual([{ label: "Detalhe", value: "texto" }]);
    expect(describeAuditDetails([1, 2])).toEqual([{ label: "Detalhe", value: "[1,2]" }]);
  });

  it("changes malformado não derruba a leitura", () => {
    const lines = describeAuditDetails({ changes: { status: "ativo", x: null } });
    expect(lines).toEqual([
      { label: "Situação", value: "Ativo" },
      { label: "x", value: "—" },
    ]);
  });
});
