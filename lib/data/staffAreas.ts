export const STAFF_AREAS = [
  { key: "treino", label: "Treino", icon: "🏋️" },
  { key: "agenda", label: "Agenda", icon: "🗓️" },
  { key: "saude", label: "Saúde / Check-ins", icon: "❤️" },
  { key: "anamnese", label: "Anamnese (SWOT)", icon: "🧭" },
  { key: "financeiro", label: "Financeiro", icon: "💰" },
] as const;

export type StaffAreaKey = (typeof STAFF_AREAS)[number]["key"];
