export const INJURY_BODY_REGIONS = [
  "Tornozelo",
  "Joelho",
  "Coxa (posterior)",
  "Coxa (anterior)",
  "Panturrilha",
  "Virilha / Adutores",
  "Pé",
  "Quadril",
  "Costas / Lombar",
  "Ombro",
  "Cotovelo / Mão",
  "Cabeça / Rosto",
  "Outro",
] as const;

export const INJURY_TYPES = [
  "Estiramento muscular",
  "Entorse / Ligamento",
  "Contusão",
  "Tendinite",
  "Fratura",
  "Lesão de crescimento (fise)",
  "Corte / Escoriação",
  "Outro",
] as const;

export const INJURY_SEVERITIES = [
  "Leve (grau 1)",
  "Moderada (grau 2)",
  "Grave (grau 3)",
] as const;

export const INJURY_STATUSES = ["Em tratamento", "Em observação", "Recuperado"] as const;

export const INJURY_SEVERITY_META: Record<
  (typeof INJURY_SEVERITIES)[number],
  { tone: "amber" | "clay" | "dark"; hint: string }
> = {
  "Leve (grau 1)": { tone: "amber", hint: "Desconforto leve, sem perda relevante de função" },
  "Moderada (grau 2)": { tone: "clay", hint: "Dor e perda parcial de função, afasta dos treinos" },
  "Grave (grau 3)": { tone: "dark", hint: "Lesão extensa, indicação de avaliação médica" },
};

export const INJURY_STATUS_TONE: Record<(typeof INJURY_STATUSES)[number], "amber" | "green" | "sky"> = {
  "Em tratamento": "amber",
  "Em observação": "sky",
  Recuperado: "green",
};
