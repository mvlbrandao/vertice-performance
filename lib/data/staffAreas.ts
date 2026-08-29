// "financeiro" saiu do catálogo em 2026-08-29: dado financeiro do atleta é
// só do treinador/empresa, staff nunca vê — ver 0067_staff_areas_expansion.sql.
export const STAFF_AREAS = [
  { key: "treino", label: "Treino", icon: "🏋️" },
  { key: "agenda", label: "Agenda", icon: "🗓️" },
  { key: "saude", label: "Saúde / Check-ins / Lesões", icon: "❤️" },
  { key: "anamnese", label: "Anamnese (SWOT)", icon: "🧭" },
  { key: "jogos", label: "Jogos", icon: "🏆" },
] as const;

export type StaffAreaKey = (typeof STAFF_AREAS)[number]["key"];
