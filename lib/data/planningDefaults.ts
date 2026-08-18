export interface PlanningColumnDefault {
  name: string;
  position: number;
  color: "dark" | "sky" | "amber" | "clay" | "green";
}

/**
 * As 5 colunas padrão de qualquer board de planejamento novo — usadas no
 * backfill da migração, no cadastro público (lib/actions/signup.ts) e na
 * geração da demo (lib/demo/generator.ts), pra nunca dessincronizar.
 */
export const DEFAULT_PLANNING_COLUMNS: PlanningColumnDefault[] = [
  { name: "Diagnóstico", position: 0, color: "dark" },
  { name: "Plano definido", position: 1, color: "sky" },
  { name: "Em desenvolvimento", position: 2, color: "amber" },
  { name: "Em validação", position: 3, color: "clay" },
  { name: "Consolidado", position: 4, color: "green" },
];
