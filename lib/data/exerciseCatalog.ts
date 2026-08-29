/**
 * Catálogo pré-cadastrado de exercícios de treino individual pra
 * futebol/futsal, no mesmo padrão do lib/data/swotCatalog.ts: lista
 * estática sugerida via datalist, sem travar o treinador — ele ainda
 * pode digitar qualquer nome que o catálogo não previu.
 */
import type { SwotPosition } from "@/lib/data/swotCatalog";

export const EXERCISE_CATEGORIES = ["Físico", "Técnico", "Tático"] as const;
export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];

export interface ExerciseCatalogEntry {
  category: ExerciseCategory;
  position: SwotPosition | null;
  name: string;
  description: string;
  focus: string;
}

export const EXERCISE_CATALOG: ExerciseCatalogEntry[] = [
  // ---- Físico — geral ----
  {
    category: "Físico",
    position: null,
    name: "Corrida intervalada",
    description: "6x 200m em ritmo forte, 1min de descanso entre tiros",
    focus: "Resistência física acima da média",
  },
  {
    category: "Físico",
    position: null,
    name: "Prancha isométrica",
    description: "3x 40s, com progressão de tempo a cada semana",
    focus: "Resistência física acima da média",
  },
  {
    category: "Físico",
    position: null,
    name: "Escada de agilidade",
    description: "4 séries variando padrão de passada, foco em coordenação",
    focus: "Velocidade de deslocamento",
  },
  {
    category: "Físico",
    position: null,
    name: "Saltos pliométricos",
    description: "4x 8 saltos em caixa, priorizando aterrissagem controlada",
    focus: "Velocidade de deslocamento",
  },
  {
    category: "Físico",
    position: null,
    name: "Treino de perna não-dominante",
    description: "Condução, passe e finalização usando só a perna não-dominante, 15min",
    focus: "Perna não-dominante pouco desenvolvida",
  },

  // ---- Técnico — geral ----
  {
    category: "Técnico",
    position: null,
    name: "Condução em cones",
    description: "3 voltas no circuito de cones, alternando perna dominante e não-dominante",
    focus: "Perna não-dominante pouco desenvolvida",
  },
  {
    category: "Técnico",
    position: null,
    name: "Domínio orientado",
    description: "Recepção de bola aérea com controle e saída em 1 toque, 20 repetições",
    focus: "Leitura de jogo / inteligência tática",
  },
  {
    category: "Técnico",
    position: null,
    name: "Passe curto em duplas",
    description: "10min de troca de passe em movimento, primeiro toque orientado",
    focus: "Comunicação com o time a desenvolver",
  },

  // ---- Técnico — Goleiro ----
  {
    category: "Técnico",
    position: "Goleiro",
    name: "Reflexo em curta distância",
    description: "Sequência de finalizações a 6m, variando lado, 15 repetições",
    focus: "Reflexos rápidos",
  },
  {
    category: "Técnico",
    position: "Goleiro",
    name: "Saída de gol em cruzamento",
    description: "10 cruzamentos da lateral, treinar leitura de trajetória e saída do gol",
    focus: "Insegurança em bolas altas/cruzamentos",
  },
  {
    category: "Técnico",
    position: "Goleiro",
    name: "Reposição de bola com os pés",
    description: "20 reposições curtas e longas, alternando pé dominante e não-dominante",
    focus: "Reposição de bola imprecisa",
  },

  // ---- Técnico — Zagueiro/Fixo ----
  {
    category: "Técnico",
    position: "Zagueiro",
    name: "Saída de bola sob pressão",
    description: "Recepção de costas pro adversário com giro e saída limpa, 15 repetições",
    focus: "Saída de bola sob pressão adversária",
  },
  {
    category: "Técnico",
    position: "Fixo",
    name: "Troca de passe sob pressão",
    description: "Rondo 4x2 em espaço reduzido, foco em decisão rápida",
    focus: "Passe de saída impreciso sob pressão",
  },

  // ---- Técnico — Lateral/Ala ----
  {
    category: "Técnico",
    position: "Lateral",
    name: "Cruzamento em corrida",
    description: "10 cruzamentos após arrancada pela linha de fundo",
    focus: "Cruzamento impreciso",
  },
  {
    category: "Técnico",
    position: "Ala",
    name: "1x1 ofensivo na linha",
    description: "Sequência de dribles contra marcador, buscando linha de fundo",
    focus: "Inconsistência no drible",
  },

  // ---- Técnico — Volante/Meia ----
  {
    category: "Técnico",
    position: "Volante",
    name: "Passe longo de troca de lado",
    description: "20 passes longos alternando lado do campo, medindo precisão",
    focus: "Passe longo impreciso",
  },
  {
    category: "Técnico",
    position: "Meia",
    name: "Último passe em movimento",
    description: "Circuito de triangulação terminando em passe decisivo, 15 repetições",
    focus: "Decisão no último terço do campo",
  },

  // ---- Técnico — Pivô/Atacante ----
  {
    category: "Técnico",
    position: "Pivô",
    name: "Finalização de costas pro gol",
    description: "Recepção de costas, giro e finalização, 15 repetições",
    focus: "Jogo de costas para o gol",
  },
  {
    category: "Técnico",
    position: "Atacante",
    name: "Finalização com perna não-dominante",
    description: "20 finalizações usando só a perna não-dominante, de dentro da área",
    focus: "Finalização com a perna não-dominante",
  },
  {
    category: "Técnico",
    position: "Atacante",
    name: "Cabeceio ofensivo",
    description: "15 cruzamentos pra finalização de cabeça, variando altura",
    focus: "Jogo aéreo a desenvolver",
  },

  // ---- Tático — geral ----
  {
    category: "Tático",
    position: null,
    name: "Leitura de vídeo do próprio jogo",
    description: "Assistir 3 lances do último jogo e anotar decisão certa/errada em cada um",
    focus: "Leitura de jogo / inteligência tática",
  },
  {
    category: "Tático",
    position: null,
    name: "Jogo posicional reduzido",
    description: "Situação de jogo em espaço reduzido, respeitando função tática da posição",
    focus: "Postura e disciplina tática",
  },
];

/** Sugestões de exercícios pra um select/datalist: posição do atleta primeiro, depois os gerais. */
export function getExerciseSuggestions(
  positions: readonly string[] = [],
): ExerciseCatalogEntry[] {
  const byPosition = EXERCISE_CATALOG.filter(
    (e) => e.position && positions.includes(e.position),
  );
  const general = EXERCISE_CATALOG.filter((e) => !e.position);
  const seen = new Set<string>();
  return [...byPosition, ...general].filter((e) => {
    if (seen.has(e.name)) return false;
    seen.add(e.name);
    return true;
  });
}
