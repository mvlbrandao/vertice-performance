import type { AuditActionType, AuditEntityType } from "@/lib/types/database";

export interface AuditArea {
  key: string;
  label: string;
  icon: string;
  entities: AuditEntityType[];
}

/**
 * As áreas seguem a pergunta que o treinador faz, não a tabela onde o dado
 * mora: "mexeram no dinheiro", "mexeram na convocação", "quem viu a ficha".
 */
export const AUDIT_AREAS: AuditArea[] = [
  { key: "financeiro", label: "Financeiro", icon: "💰", entities: ["charge", "expense", "cash_closure"] },
  { key: "atletas", label: "Atletas", icon: "🧍", entities: ["athlete"] },
  { key: "escalacao", label: "Escalação", icon: "🏆", entities: ["lineup"] },
  { key: "saude", label: "Saúde", icon: "🩹", entities: ["injury"] },
  { key: "acesso", label: "Acesso", icon: "🔑", entities: ["access"] },
  { key: "desafios", label: "Desafios", icon: "🎯", entities: ["challenge"] },
];

export function areaOf(entity: AuditEntityType): AuditArea | undefined {
  return AUDIT_AREAS.find((a) => a.entities.includes(entity));
}

export const ACTION_LABEL: Record<AuditActionType, string> = {
  status_change: "Mudança de status",
  due_date_change: "Alteração de vencimento",
  edit: "Edição",
  delete: "Exclusão",
  reopen: "Reabertura",
  create: "Criação",
  deactivate: "Desativação",
  reactivate: "Reativação",
  transfer: "Transferência",
  publish: "Publicação",
  unpublish: "Despublicação",
  grant: "Acesso concedido",
  revoke: "Acesso revogado",
  review: "Avaliação",
};

const FIELD_LABEL: Record<string, string> = {
  full_name: "nome",
  birth_date: "nascimento",
  position: "posição",
  sex: "sexo",
  guardian_name: "responsável",
  guardian_phone: "telefone do responsável",
  athlete_phone: "telefone",
  instagram: "Instagram",
  height_cm: "altura",
  weight_kg: "peso",
  status: "status",
  expected_return_date: "previsão de retorno",
  description: "descrição",
  amount_cents: "valor",
};

function formatCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function show(value: unknown): string {
  if (value === null || value === undefined || value === "") return "vazio";
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "vazio";
  return String(value);
}

export function describeDetails(
  entity: AuditEntityType,
  action: AuditActionType,
  details: Record<string, unknown>,
): string {
  if (action === "status_change" || action === "due_date_change") {
    return `${show(details.from)} → ${show(details.to)}`;
  }

  if (action === "edit" && details.changes) {
    const changes = details.changes as Record<string, { from: unknown; to: unknown }>;
    return Object.entries(changes)
      .map(([field, c]) => `${FIELD_LABEL[field] ?? field}: ${show(c.from)} → ${show(c.to)}`)
      .join(" · ");
  }

  if (action === "edit" && entity === "injury") {
    return Object.entries(details)
      .map(([field, c]) => {
        const change = c as { from: unknown; to: unknown };
        return `${FIELD_LABEL[field] ?? field}: ${show(change.from)} → ${show(change.to)}`;
      })
      .join(" · ");
  }

  if (action === "edit") {
    // Formato antigo do financeiro: retratos inteiros de antes e depois.
    const from = details.from as Record<string, unknown> | null;
    const to = details.to as Record<string, unknown> | null;
    if (!from || !to) return details.staff_areas ? `áreas: ${show(details.staff_areas)}` : "—";
    const parts: string[] = [];
    if (from.description !== to.description) {
      parts.push(`descrição: "${from.description}" → "${to.description}"`);
    }
    if (from.amount_cents !== to.amount_cents) {
      parts.push(`valor: ${formatCents(Number(from.amount_cents))} → ${formatCents(Number(to.amount_cents))}`);
    }
    return parts.length > 0 ? parts.join(" · ") : "sem alterações de conteúdo";
  }

  if (action === "reopen") {
    const originalClose = details.originally_closed_by
      ? `fechado originalmente por ${details.originally_closed_by}`
      : "";
    const reason = details.reason ? `motivo: ${details.reason}` : "sem motivo informado";
    return [originalClose, reason].filter(Boolean).join(" · ");
  }

  if (action === "transfer") {
    const team = `${show(details.from_team)} → ${show(details.to_team)}`;
    const category =
      details.from_category !== details.to_category
        ? ` · categoria: ${show(details.from_category)} → ${show(details.to_category)}`
        : "";
    return team + category;
  }

  if (action === "deactivate") {
    const charges = details.cancel_future_charges ? " · cobranças futuras canceladas" : "";
    return `${show(details.reason)}${charges}`;
  }

  if (action === "review") {
    const points = details.points_awarded ? ` · +${details.points_awarded} pts` : "";
    return `${show(details.challenge)}: ${show(details.decision)}${points}`;
  }

  if (action === "grant") {
    if (details.convite) return `convite por link resgatado (${show(details.email)})`;
    return `nível ${show(details.access_level)}`;
  }

  if (action === "revoke") return "acesso removido";

  if (action === "create" && entity === "access") {
    if (details.convite) return `link de convite gerado para ${show(details.full_name)}`;
    return `profissional convidado: ${show(details.staff_name)} (${show(details.email)})`;
  }

  if (action === "create" && entity === "injury") {
    return `${show(details.body_region)} · ${show(details.injury_type)} · ${show(details.severity)}`;
  }

  if (action === "delete" && entity === "injury") {
    return `${show(details.body_region)} · ${show(details.injury_type)} · ${show(details.severity)}`;
  }

  if (action === "create" && entity === "athlete") {
    return show(details.category) === "vazio" ? "cadastro criado" : `categoria ${show(details.category)}`;
  }

  if (action === "publish") return `${show(details.convocados)} convocados notificados`;

  return "—";
}
