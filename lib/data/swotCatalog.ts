/**
 * Catálogo pré-cadastrado de pontos SWOT para atletas de futebol/futsal,
 * organizado por categoria (Força/Fraqueza/Oportunidade/Ameaça) e, quando
 * fizer sentido, por posição. Substitui o campo de descrição totalmente
 * livre no diagnóstico SWOT por uma lista fechada — o modal ainda oferece
 * "Outro" como escape hatch pra não travar um caso real que o catálogo não
 * previu.
 *
 * Força/Fraqueza são atributos do atleta, então variam por posição.
 * Oportunidade/Ameaça são fatores de contexto (peneira, calendário, lesão,
 * concorrência interna) e por isso ficam só como itens gerais — não fazem
 * sentido "por posição".
 */
import type { SwotCategory } from "@/lib/types/database";

export const SWOT_POSITIONS = [
  "Goleiro",
  "Fixo",
  "Ala",
  "Pivô",
  "Zagueiro",
  "Lateral",
  "Volante",
  "Meia",
  "Atacante",
] as const;

export type SwotPosition = (typeof SWOT_POSITIONS)[number];

export interface SwotCatalogEntry {
  category: SwotCategory;
  position: SwotPosition | null;
  text: string;
}

export const SWOT_CATALOG: SwotCatalogEntry[] = [
  // ---- Força — geral ----
  { category: "Força", position: null, text: "Alta confiança em jogadas de risco" },
  { category: "Força", position: null, text: "Liderança dentro de campo" },
  { category: "Força", position: null, text: "Boa comunicação com o time" },
  { category: "Força", position: null, text: "Resistência física acima da média" },
  { category: "Força", position: null, text: "Ambidestria (bom com as duas pernas)" },
  { category: "Força", position: null, text: "Leitura de jogo / inteligência tática" },
  { category: "Força", position: null, text: "Trabalho em equipe" },
  { category: "Força", position: null, text: "Concentração durante toda a partida" },
  { category: "Força", position: null, text: "Velocidade de deslocamento" },
  { category: "Força", position: null, text: "Postura e disciplina tática" },
  // ---- Força — Goleiro ----
  { category: "Força", position: "Goleiro", text: "Reflexos rápidos" },
  { category: "Força", position: "Goleiro", text: "Segurança em bolas aéreas" },
  { category: "Força", position: "Goleiro", text: "Bom com os pés (saída jogada)" },
  { category: "Força", position: "Goleiro", text: "Comando de área" },
  { category: "Força", position: "Goleiro", text: "Boa reposição de bola" },
  { category: "Força", position: "Goleiro", text: "Posicionamento no gol" },
  // ---- Força — Zagueiro ----
  { category: "Força", position: "Zagueiro", text: "Domínio no jogo aéreo" },
  { category: "Força", position: "Zagueiro", text: "Marcação individual firme" },
  { category: "Força", position: "Zagueiro", text: "Antecipação de jogadas" },
  { category: "Força", position: "Zagueiro", text: "Saída de bola limpa" },
  { category: "Força", position: "Zagueiro", text: "Presença física em duelos" },
  // ---- Força — Lateral ----
  { category: "Força", position: "Lateral", text: "Fôlego para subir e voltar" },
  { category: "Força", position: "Lateral", text: "Cruzamento preciso" },
  { category: "Força", position: "Lateral", text: "Eficiência no 1x1 defensivo" },
  { category: "Força", position: "Lateral", text: "Velocidade de recomposição" },
  // ---- Força — Volante ----
  { category: "Força", position: "Volante", text: "Interceptação de passes" },
  { category: "Força", position: "Volante", text: "Distribuição de jogo" },
  { category: "Força", position: "Volante", text: "Cobertura da defesa" },
  { category: "Força", position: "Volante", text: "Desarme limpo" },
  // ---- Força — Meia ----
  { category: "Força", position: "Meia", text: "Visão de jogo / último passe" },
  { category: "Força", position: "Meia", text: "Chegada ao ataque" },
  { category: "Força", position: "Meia", text: "Drible curto em espaço reduzido" },
  { category: "Força", position: "Meia", text: "Qualidade em bola parada" },
  // ---- Força — Ala ----
  { category: "Força", position: "Ala", text: "Drible em velocidade" },
  { category: "Força", position: "Ala", text: "Cruzamento" },
  { category: "Força", position: "Ala", text: "Eficiência no 1x1 ofensivo" },
  { category: "Força", position: "Ala", text: "Finalização de fora da área" },
  // ---- Força — Pivô/Atacante ----
  { category: "Força", position: "Pivô", text: "Jogo de costas para o gol" },
  { category: "Força", position: "Pivô", text: "Faro de gol / oportunismo na área" },
  { category: "Força", position: "Pivô", text: "Cabeceio ofensivo" },
  { category: "Força", position: "Atacante", text: "Jogo de costas para o gol" },
  { category: "Força", position: "Atacante", text: "Faro de gol / oportunismo na área" },
  { category: "Força", position: "Atacante", text: "Cabeceio ofensivo" },
  { category: "Força", position: "Atacante", text: "Finalização de longa distância" },
  // ---- Força — Fixo ----
  { category: "Força", position: "Fixo", text: "Organização do jogo pelo fundo" },
  { category: "Força", position: "Fixo", text: "Marcação na saída de bola adversária" },
  { category: "Força", position: "Fixo", text: "Troca de passes sob pressão" },
  { category: "Força", position: "Fixo", text: "Liderança na construção defensiva" },

  // ---- Fraqueza — geral ----
  { category: "Fraqueza", position: null, text: "Perna não-dominante pouco desenvolvida" },
  { category: "Fraqueza", position: null, text: "Baixa confiança em duelos" },
  { category: "Fraqueza", position: null, text: "Oscilação de concentração durante o jogo" },
  { category: "Fraqueza", position: null, text: "Resistência física a melhorar" },
  { category: "Fraqueza", position: null, text: "Comunicação com o time a desenvolver" },
  { category: "Fraqueza", position: null, text: "Faltas desnecessárias por indisciplina tática" },
  { category: "Fraqueza", position: null, text: "Dificuldade de controle emocional sob pressão" },
  { category: "Fraqueza", position: null, text: "Velocidade de deslocamento abaixo do exigido" },
  // ---- Fraqueza — Goleiro ----
  { category: "Fraqueza", position: "Goleiro", text: "Insegurança em bolas altas/cruzamentos" },
  { category: "Fraqueza", position: "Goleiro", text: "Saída de gol precipitada" },
  { category: "Fraqueza", position: "Goleiro", text: "Reposição de bola imprecisa" },
  { category: "Fraqueza", position: "Goleiro", text: "Posicionamento em finalizações de longe" },
  // ---- Fraqueza — Zagueiro ----
  { category: "Fraqueza", position: "Zagueiro", text: "Lentidão na recomposição defensiva" },
  { category: "Fraqueza", position: "Zagueiro", text: "Erro de antecipação em jogadas rápidas" },
  { category: "Fraqueza", position: "Zagueiro", text: "Dificuldade de marcação sob pressão" },
  { category: "Fraqueza", position: "Zagueiro", text: "Saída de bola sob pressão adversária" },
  // ---- Fraqueza — Lateral ----
  { category: "Fraqueza", position: "Lateral", text: "Fragilidade no 1x1 defensivo" },
  { category: "Fraqueza", position: "Lateral", text: "Cruzamento impreciso" },
  { category: "Fraqueza", position: "Lateral", text: "Queda de rendimento físico no 2º tempo" },
  { category: "Fraqueza", position: "Lateral", text: "Demora para retornar à marcação" },
  // ---- Fraqueza — Volante ----
  { category: "Fraqueza", position: "Volante", text: "Passe longo impreciso" },
  { category: "Fraqueza", position: "Volante", text: "Excesso de faltas na marcação" },
  { category: "Fraqueza", position: "Volante", text: "Cobertura tardia dos zagueiros" },
  { category: "Fraqueza", position: "Volante", text: "Dificuldade de saída jogada sob pressão" },
  // ---- Fraqueza — Meia ----
  { category: "Fraqueza", position: "Meia", text: "Finalização a desenvolver" },
  { category: "Fraqueza", position: "Meia", text: "Perda de bola sob pressão no meio-campo" },
  { category: "Fraqueza", position: "Meia", text: "Pouca participação na marcação" },
  { category: "Fraqueza", position: "Meia", text: "Decisão no último terço do campo" },
  // ---- Fraqueza — Ala ----
  { category: "Fraqueza", position: "Ala", text: "Inconsistência no drible" },
  { category: "Fraqueza", position: "Ala", text: "Definição na frente do gol" },
  { category: "Fraqueza", position: "Ala", text: "Retorno defensivo insuficiente" },
  // ---- Fraqueza — Pivô/Atacante ----
  { category: "Fraqueza", position: "Pivô", text: "Finalização com a perna não-dominante" },
  { category: "Fraqueza", position: "Pivô", text: "Pouca participação na construção do jogo" },
  { category: "Fraqueza", position: "Pivô", text: "Isolamento em jogadas de apoio" },
  { category: "Fraqueza", position: "Atacante", text: "Finalização com a perna não-dominante" },
  { category: "Fraqueza", position: "Atacante", text: "Jogo aéreo a desenvolver" },
  { category: "Fraqueza", position: "Atacante", text: "Isolamento em jogadas de apoio" },
  // ---- Fraqueza — Fixo ----
  { category: "Fraqueza", position: "Fixo", text: "Passe de saída impreciso sob pressão" },
  { category: "Fraqueza", position: "Fixo", text: "Antecipação defensiva a melhorar" },
  { category: "Fraqueza", position: "Fixo", text: "Comunicação na organização defensiva" },

  // ---- Oportunidade — geral (contextual, não varia por posição) ----
  { category: "Oportunidade", position: null, text: "Peneira/observação de olheiros marcada" },
  { category: "Oportunidade", position: null, text: "Torneio ou copa regional próxima" },
  { category: "Oportunidade", position: null, text: "Vaga em aberto no time titular" },
  { category: "Oportunidade", position: null, text: "Convite para treino em clube maior" },
  { category: "Oportunidade", position: null, text: "Ano de transição de categoria (sub)" },
  {
    category: "Oportunidade",
    position: null,
    text: "Parceria do clube com equipe de categoria superior",
  },
  { category: "Oportunidade", position: null, text: "Programa de intercâmbio/bolsa esportiva" },
  { category: "Oportunidade", position: null, text: "Aumento de minutos em jogo por lesão de outro atleta" },

  // ---- Ameaça — geral (contextual, não varia por posição) ----
  { category: "Ameaça", position: null, text: "Concorrência interna forte na posição" },
  { category: "Ameaça", position: null, text: "Histórico de lesão recorrente" },
  { category: "Ameaça", position: null, text: "Idade limite da categoria se aproximando" },
  { category: "Ameaça", position: null, text: "Dificuldade de conciliar estudos e treinos" },
  { category: "Ameaça", position: null, text: "Baixa frequência em treinos/encontros" },
  { category: "Ameaça", position: null, text: "Pressão familiar ou externa excessiva" },
  { category: "Ameaça", position: null, text: "Corte técnico na peneira/seletiva" },
  { category: "Ameaça", position: null, text: "Adversário de nível elevado na fase decisiva" },
];

/** Sugestões pra um select de SWOT: posição do atleta primeiro, depois as gerais. */
export function getSwotCatalogSuggestions(
  category: SwotCategory,
  positions: readonly string[] = [],
): string[] {
  const byPosition = SWOT_CATALOG.filter(
    (e) => e.category === category && e.position && positions.includes(e.position),
  ).map((e) => e.text);
  const general = SWOT_CATALOG.filter((e) => e.category === category && !e.position).map(
    (e) => e.text,
  );
  return Array.from(new Set([...byPosition, ...general]));
}

/** Sugestões de foco de treino/encontro: só Força/Fraqueza fazem sentido como tema de trabalho. */
export function getFocusTagSuggestions(positions: readonly string[] = []): string[] {
  return Array.from(
    new Set([
      ...getSwotCatalogSuggestions("Força", positions),
      ...getSwotCatalogSuggestions("Fraqueza", positions),
    ]),
  );
}
