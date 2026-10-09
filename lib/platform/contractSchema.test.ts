import { describe, expect, it } from "vitest";
import {
  activateContractSchema,
  cancelContractSchema,
  closeContractSchema,
  confirmDocumentSchema,
  CONTRACT_LIMITS,
  createContractSchema,
  formDataToRecord,
  isUuid,
  renewContractSchema,
  summarizeIssues,
  updateContractSchema,
} from "@/lib/platform/contractSchema";

const CLUB = "3f2b1c9e-8a47-4d1e-9c55-0a1b2c3d4e5f";
const CONTRACT = "7a1d2e3f-4b5c-4d6e-8f70-a1b2c3d4e5f6";

const valido = {
  clubId: CLUB,
  planName: "Plano Clube",
  priceReais: "149,90",
  maxAthletes: "",
  billingCycle: "mensal",
  startsOn: "2026-10-01",
  endsOn: "2026-10-31",
  autoRenew: "true",
  signedOn: "",
  signerName: "",
  signerRole: "",
  termsVersion: "",
  notes: "",
};

function criar(over: Record<string, string | undefined> = {}) {
  return createContractSchema.safeParse({ ...valido, ...over });
}

function mensagem(over: Record<string, string | undefined>): string | null {
  const r = criar(over);
  return r.success ? null : summarizeIssues(r.error).error;
}

describe("createContractSchema: caminho feliz", () => {
  it("converte o formulário nas colunas do banco", () => {
    const r = criar();
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data).toEqual({
      clubId: CLUB,
      status: "rascunho",
      replace: false,
      fields: {
        plan_name: "Plano Clube",
        price_cents: 14990,
        max_athletes: null,
        billing_cycle: "mensal",
        starts_on: "2026-10-01",
        ends_on: "2026-10-31",
        auto_renew: true,
        signed_on: null,
        signer_name: null,
        signer_role: null,
        terms_version: null,
        notes: null,
      },
    });
  });

  it("apara espaços das pontas dos textos", () => {
    const r = criar({ planName: "  Plano Clube  ", signerName: "  Maria  ", notes: " obs " });
    expect(r.success && r.data.fields).toMatchObject({
      plan_name: "Plano Clube",
      signer_name: "Maria",
      notes: "obs",
    });
  });

  it("fim vazio = prazo indeterminado", () => {
    const r = criar({ endsOn: "" });
    expect(r.success && r.data.fields.ends_on).toBeNull();
  });

  it("pode nascer vigente, com confirmação de substituição", () => {
    const r = criar({ status: "vigente", replace: "true" });
    expect(r.success && [r.data.status, r.data.replace]).toEqual(["vigente", true]);
  });
});

describe("createContractSchema: plano", () => {
  it("recusa nome vazio, em branco ou ausente", () => {
    expect(mensagem({ planName: "" })).toBe("Informe o nome do plano.");
    expect(mensagem({ planName: "   " })).toBe("Informe o nome do plano.");
    expect(mensagem({ planName: undefined })).toBe("Informe o nome do plano.");
  });

  it("limite de tamanho na fronteira", () => {
    expect(criar({ planName: "a".repeat(CONTRACT_LIMITS.planName) }).success).toBe(true);
    expect(mensagem({ planName: "a".repeat(CONTRACT_LIMITS.planName + 1) })).toContain("no máximo 80");
  });
});

describe("createContractSchema: preço", () => {
  it("aceita zero (contrato gratuito), com e sem casas", () => {
    for (const valor of ["0", "0,00", "0.00", "R$ 0,00"]) {
      const r = criar({ priceReais: valor });
      expect(r.success && r.data.fields.price_cents, valor).toBe(0);
    }
  });

  it("usa o parser único de reais: milhar, vírgula e ponto decimal", () => {
    const cents = (valor: string) => {
      const r = criar({ priceReais: valor });
      return r.success ? r.data.fields.price_cents : null;
    };
    expect(cents("1.499,90")).toBe(149990);
    expect(cents("149,9")).toBe(14990);
    // O erro histórico: "149.90" não pode virar R$ 14.990,00.
    expect(cents("149.90")).toBe(14990);
    expect(cents("1.499")).toBe(149900);
  });

  it("recusa vazio com mensagem própria", () => {
    expect(mensagem({ priceReais: "" })).toContain("Informe o valor");
    expect(mensagem({ priceReais: undefined })).toContain("Informe o valor");
  });

  it("recusa negativo, texto e valor acima do teto", () => {
    expect(mensagem({ priceReais: "-5" })).toContain("Valor inválido");
    expect(mensagem({ priceReais: "abc" })).toContain("Valor inválido");
    expect(mensagem({ priceReais: "1,2,3" })).toContain("Valor inválido");
    expect(mensagem({ priceReais: "1.000.000,01" })).toContain("Valor inválido");
    expect(criar({ priceReais: "1.000.000,00" }).success).toBe(true);
  });
});

describe("createContractSchema: cota", () => {
  const quota = (valor: string) => {
    const r = criar({ maxAthletes: valor });
    return r.success ? r.data.fields.max_athletes : "erro";
  };

  it("vazia = cota padrão da plataforma (null)", () => {
    expect(quota("")).toBeNull();
    expect(quota("   ")).toBeNull();
  });

  it("inteiro de 1 a 100 mil", () => {
    expect(quota("1")).toBe(1);
    expect(quota("50")).toBe(50);
    expect(quota(String(CONTRACT_LIMITS.maxAthletes))).toBe(CONTRACT_LIMITS.maxAthletes);
  });

  it("recusa zero, negativo, decimal, texto e acima do teto", () => {
    for (const valor of ["0", "-1", "1.5", "1,5", "dez", "1e3", String(CONTRACT_LIMITS.maxAthletes + 1), "99999999999999999999"]) {
      expect(quota(valor), valor).toBe("erro");
    }
    expect(mensagem({ maxAthletes: "0" })).toContain("Cota inválida");
  });
});

describe("createContractSchema: ciclo e renovação", () => {
  it("só aceita os quatro ciclos", () => {
    for (const ciclo of ["mensal", "trimestral", "semestral", "anual"]) {
      expect(criar({ billingCycle: ciclo }).success, ciclo).toBe(true);
    }
    expect(mensagem({ billingCycle: "quinzenal" })).toBe("Escolha o ciclo de cobrança.");
    expect(mensagem({ billingCycle: undefined })).toBe("Escolha o ciclo de cobrança.");
  });

  it("renovação automática aceita true/false/on/off e exige um deles", () => {
    const valor = (v: string) => {
      const r = criar({ autoRenew: v });
      return r.success ? r.data.fields.auto_renew : "erro";
    };
    expect(valor("true")).toBe(true);
    expect(valor("on")).toBe(true);
    expect(valor("false")).toBe(false);
    expect(valor("off")).toBe(false);
    expect(valor("talvez")).toBe("erro");
    expect(mensagem({ autoRenew: undefined })).toBe("Informe se renova automaticamente.");
  });
});

describe("createContractSchema: datas", () => {
  it("início é obrigatório e precisa existir no calendário", () => {
    expect(mensagem({ startsOn: "" })).toBe("Início: informe a data.");
    expect(mensagem({ startsOn: undefined })).toBe("Início: informe a data.");
    expect(mensagem({ startsOn: "2026-02-30" })).toBe("Início: informe uma data válida.");
    expect(mensagem({ startsOn: "01/10/2026" })).toBe("Início: informe uma data válida.");
    expect(mensagem({ startsOn: "2026-13-01" })).toBe("Início: informe uma data válida.");
  });

  it("fim, assinatura: opcionais, mas válidas quando preenchidas", () => {
    expect(mensagem({ endsOn: "2026-02-30" })).toBe("Fim: informe uma data válida.");
    expect(mensagem({ signedOn: "ontem" })).toBe("Data da assinatura: informe uma data válida.");
    expect(criar({ signedOn: "2026-09-30" }).success).toBe(true);
  });

  it("fim igual ao início vale (contrato de um dia); fim anterior ao início não", () => {
    expect(criar({ startsOn: "2026-10-01", endsOn: "2026-10-01" }).success).toBe(true);
    expect(mensagem({ startsOn: "2026-10-01", endsOn: "2026-09-30" })).toBe(
      "A data de fim não pode ser anterior à de início.",
    );
  });

  it("o erro de período aponta o campo do fim", () => {
    const r = criar({ startsOn: "2026-10-02", endsOn: "2026-10-01" });
    expect(!r.success && summarizeIssues(r.error).fieldErrors).toHaveProperty("endsOn");
  });

  it("29/02 só em ano bissexto", () => {
    expect(criar({ startsOn: "2028-02-29", endsOn: "2029-02-27" }).success).toBe(true);
    expect(mensagem({ startsOn: "2027-02-29" })).toBe("Início: informe uma data válida.");
  });
});

describe("createContractSchema: textos opcionais e situação", () => {
  it("notas no limite passam; um caractere a mais é recusado (sem cortar em silêncio)", () => {
    expect(criar({ notes: "n".repeat(CONTRACT_LIMITS.notes) }).success).toBe(true);
    expect(mensagem({ notes: "n".repeat(CONTRACT_LIMITS.notes + 1) })).toBe(
      "Notas internas: no máximo 2000 caracteres.",
    );
  });

  it("limites de quem assinou, cargo e versão dos termos", () => {
    expect(mensagem({ signerName: "a".repeat(CONTRACT_LIMITS.signerName + 1) })).toContain("120");
    expect(mensagem({ signerRole: "a".repeat(CONTRACT_LIMITS.signerRole + 1) })).toContain("80");
    expect(mensagem({ termsVersion: "a".repeat(CONTRACT_LIMITS.termsVersion + 1) })).toContain("40");
  });

  it("um contrato novo só nasce rascunho ou vigente", () => {
    const semStatus = criar({ status: "" });
    expect(semStatus.success && semStatus.data.status).toBe("rascunho");
    expect(mensagem({ status: "encerrado" })).toBe("Um contrato novo só pode nascer como rascunho ou vigente.");
    expect(mensagem({ status: "cancelado" })).toContain("rascunho ou vigente");
  });

  it("clube precisa ser um uuid", () => {
    expect(mensagem({ clubId: "" })).toBe("Escolha o clube.");
    expect(mensagem({ clubId: "nao-e-uuid" })).toBe("Escolha o clube.");
    expect(mensagem({ clubId: undefined })).toBe("Escolha o clube.");
  });

  it("confirmação de substituição só vale quando explícita", () => {
    const r = criar({ replace: undefined });
    expect(r.success && r.data.replace).toBe(false);
    const r2 = criar({ replace: "qualquer coisa" });
    expect(r2.success && r2.data.replace).toBe(false);
  });
});

describe("updateContractSchema", () => {
  const edicao = { contractId: CONTRACT, ...{ ...valido, clubId: undefined } };

  it("aceita os mesmos campos e devolve o id do contrato; clube e situação não entram", () => {
    const r = updateContractSchema.safeParse({ ...edicao, clubId: "outro-clube", status: "encerrado" });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(Object.keys(r.data).sort()).toEqual(["contractId", "fields"]);
    expect(r.data.fields).not.toHaveProperty("club_id");
    expect(r.data.fields).not.toHaveProperty("status");
  });

  it("recusa id malformado e período invertido", () => {
    const ruim = updateContractSchema.safeParse({ ...edicao, contractId: "123" });
    expect(!ruim.success && summarizeIssues(ruim.error).error).toBe("Contrato inválido.");
    const invertido = updateContractSchema.safeParse({ ...edicao, startsOn: "2026-10-02", endsOn: "2026-10-01" });
    expect(invertido.success).toBe(false);
  });
});

describe("encerrar e cancelar", () => {
  it("motivo obrigatório, com mínimo e máximo", () => {
    for (const schema of [closeContractSchema, cancelContractSchema]) {
      expect(schema.safeParse({ contractId: CONTRACT, reason: "" }).success).toBe(false);
      expect(schema.safeParse({ contractId: CONTRACT, reason: "  ab " }).success).toBe(false);
      expect(schema.safeParse({ contractId: CONTRACT }).success).toBe(false);
      expect(schema.safeParse({ contractId: CONTRACT, reason: "abc" }).success).toBe(true);
      expect(schema.safeParse({ contractId: CONTRACT, reason: "a".repeat(CONTRACT_LIMITS.reason) }).success).toBe(true);
      expect(schema.safeParse({ contractId: CONTRACT, reason: "a".repeat(CONTRACT_LIMITS.reason + 1) }).success).toBe(false);
      expect(schema.safeParse({ contractId: "x", reason: "abc" }).success).toBe(false);
    }
  });

  it("a mensagem diz de qual ação é o motivo", () => {
    const fechar = closeContractSchema.safeParse({ contractId: CONTRACT, reason: "" });
    expect(!fechar.success && summarizeIssues(fechar.error).error).toContain("encerramento");
    const cancelar = cancelContractSchema.safeParse({ contractId: CONTRACT, reason: "" });
    expect(!cancelar.success && summarizeIssues(cancelar.error).error).toContain("cancelamento");
  });

  it("motivo vem aparado", () => {
    const r = closeContractSchema.safeParse({ contractId: CONTRACT, reason: "  cliente saiu  " });
    expect(r.success && r.data.reason).toBe("cliente saiu");
  });
});

describe("ativar, renovar e documento", () => {
  it("ativar: replace só é true quando marcado", () => {
    const r = activateContractSchema.safeParse({ contractId: CONTRACT, replace: "true" });
    expect(r.success && r.data.replace).toBe(true);
    const sem = activateContractSchema.safeParse({ contractId: CONTRACT });
    expect(sem.success && sem.data.replace).toBe(false);
    expect(activateContractSchema.safeParse({ contractId: "x" }).success).toBe(false);
  });

  it("renovar exige um uuid", () => {
    expect(renewContractSchema.safeParse({ contractId: CONTRACT }).success).toBe(true);
    expect(renewContractSchema.safeParse({ contractId: "1" }).success).toBe(false);
  });

  it("confirmar documento: id válido e caminho de tamanho razoável", () => {
    expect(confirmDocumentSchema.safeParse({ contractId: CONTRACT, path: "a/b/c.pdf" }).success).toBe(true);
    expect(confirmDocumentSchema.safeParse({ contractId: CONTRACT, path: "" }).success).toBe(false);
    expect(confirmDocumentSchema.safeParse({ contractId: CONTRACT, path: "a".repeat(301) }).success).toBe(false);
    expect(confirmDocumentSchema.safeParse({ contractId: "x", path: "a.pdf" }).success).toBe(false);
  });
});

describe("utilitários", () => {
  it("isUuid", () => {
    expect(isUuid(CLUB)).toBe(true);
    expect(isUuid(CLUB.toUpperCase())).toBe(true);
    expect(isUuid("3f2b1c9e-8a47-4d1e-9c55-0a1b2c3d4e5")).toBe(false);
    expect(isUuid(`${CLUB}x`)).toBe(false);
    expect(isUuid(undefined)).toBe(false);
    expect(isUuid(42)).toBe(false);
  });

  it("formDataToRecord ignora arquivos e mantém textos", () => {
    const fd = new FormData();
    fd.set("a", "1");
    fd.set("arquivo", new Blob(["x"]), "x.pdf");
    expect(formDataToRecord(fd)).toEqual({ a: "1" });
  });

  it("summarizeIssues guarda a primeira mensagem de cada campo", () => {
    const r = criar({ planName: "", priceReais: "-1" });
    expect(r.success).toBe(false);
    if (r.success) return;
    const resumo = summarizeIssues(r.error);
    expect(Object.keys(resumo.fieldErrors).sort()).toEqual(["planName", "priceReais"]);
    expect(resumo.error).toBe(r.error.issues[0].message);
  });
});
