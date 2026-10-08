/**
 * Regra pura do score do atleta: recebe as linhas já lidas e devolve a nota.
 *
 * Fica fora de lib/scoring.ts de propósito. Aquele módulo importa
 * "server-only" (lê o banco) e por isso não carrega em teste; a regra de
 * negócio, que é o que precisa de teste, não tem motivo para ficar presa
 * a ele. Antes existiam duas cópias da mesma regra (computePlayerScore e
 * computePlayerScores) e qualquer ajuste de peso tinha que ser feito nas duas.
 */

export interface PlayerScore {
  overall: number;
  attack: number;
  defense: number;
  discipline: number;
  physical: number;
  mental: number;
  commitment: number;
  development: number;
  warnings: string[];
}

export const ATTACKING_POSITIONS = ["Atacante", "Pivô", "Ala"];
export const COLD_STREAK_GAMES = 5;
export const COLD_STREAK_MIN_GAMES = 3;
export const COLD_STREAK_PENALTY = 12;

export function clamp(n: number, min = 0, max = 99) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** Tudo que a regra consome de UM atleta, já filtrado pelas consultas. */
export interface EntradaScore {
  /** Data civil de hoje (YYYY-MM-DD). Injetada para o cálculo ser determinístico. */
  hoje: string;
  eventos: { event_type: string; game_id: string }[];
  exercicios: { done: boolean }[];
  /** Encontros não cancelados. */
  encontros: { athlete_confirmed: boolean }[];
  /** Notas de confiança dos registros mentais; nulos são ignorados aqui também. */
  confiancas: (number | null)[];
  /** Pontos de Fraqueza/Ameaça da análise SWOT. */
  swot: { status: string }[];
  posicoes: string[];
  /** Escalações com a data do jogo (nula quando o jogo não veio no join). */
  escalacoes: { game_id: string; data: string | null }[];
}

/**
 * Nota 0-99 por atleta, estilo card de game, calculada só a partir do que já
 * é registrado no app (sem input manual extra):
 *
 * - Ataque: gols e assistências da súmula (peso maior pro gol), com bônus/
 *   penalidade pelas finalizações certas/erradas.
 * - Defesa: desarmes, interceptações e defesas (goleiro) da súmula.
 * - Disciplina: começa em 99 e desconta por cartão/falta na súmula.
 * - Físico: % de treinos prescritos concluídos.
 * - Mental: média da nota de confiança dos registros mentais (0-10 → 0-99).
 * - Compromisso: % de encontros confirmados pelo atleta.
 * - Desenvolvimento: % dos pontos de Fraqueza/Ameaça da análise SWOT (todos
 *   os ciclos) que já foram concluídos — mede se o plano de evolução está
 *   sendo executado, não só registrado.
 *
 * Dimensão sem nenhum dado ainda fica em 50 (neutro) pra não penalizar um
 * atleta recém-cadastrado. A exceção é Disciplina, que sem súmula fica em 99
 * (ninguém levou cartão): por isso o geral de quem não tem dado nenhum é 57,
 * não 50.
 */
export function calcularPlayerScore(entrada: EntradaScore): PlayerScore {
  const { eventos } = entrada;
  const porTipo = new Map<string, number>();
  for (const e of eventos) porTipo.set(e.event_type, (porTipo.get(e.event_type) ?? 0) + 1);
  const count = (tipo: string) => porTipo.get(tipo) ?? 0;

  const warnings: string[] = [];
  const hasEvents = eventos.length > 0;

  let attack = hasEvents
    ? clamp(
        50 +
          count("Gol") * 8 +
          count("Assistência") * 5 +
          count("Finalização certa") * 2 -
          count("Finalização errada") * 1,
      )
    : 50;

  // Sinal negativo específico: atacante em "seca de gols" — jogou os
  // últimos jogos e não marcou nenhum. Puxa o ataque pra baixo mesmo que
  // o acumulado histórico ainda esteja alto.
  const isAttacker = entrada.posicoes.some((p) => ATTACKING_POSITIONS.includes(p));
  const recentGameIds = entrada.escalacoes
    .filter((l) => l.data && l.data <= entrada.hoje)
    .sort((a, b) => (b.data as string).localeCompare(a.data as string))
    .slice(0, COLD_STREAK_GAMES)
    .map((l) => l.game_id);

  if (isAttacker && recentGameIds.length >= COLD_STREAK_MIN_GAMES) {
    const recentes = new Set(recentGameIds);
    const goalsInRecentGames = eventos.filter(
      (e) => e.event_type === "Gol" && recentes.has(e.game_id),
    ).length;
    if (goalsInRecentGames === 0) {
      attack = clamp(attack - COLD_STREAK_PENALTY);
      warnings.push(
        `⚠️ Sem gols nas últimas ${recentGameIds.length} partidas — finalização penalizada no ataque.`,
      );
    }
  }

  const defense = hasEvents
    ? clamp(50 + count("Desarme") * 5 + count("Interceptação") * 4 + count("Defesa") * 6)
    : 50;
  const discipline = hasEvents
    ? clamp(99 - (count("Cartão amarelo") * 8 + count("Cartão vermelho") * 20 + count("Falta") * 3))
    : 99;

  const totalExercises = entrada.exercicios.length;
  const physical = totalExercises
    ? clamp(30 + (entrada.exercicios.filter((e) => e.done).length / totalExercises) * 69)
    : 50;

  const confidenceScores = entrada.confiancas.filter((s): s is number => s != null);
  const mental = confidenceScores.length
    ? clamp((confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length) * 9.9)
    : 50;

  const totalMeetings = entrada.encontros.length;
  const commitment = totalMeetings
    ? clamp(30 + (entrada.encontros.filter((m) => m.athlete_confirmed).length / totalMeetings) * 69)
    : 50;

  const totalSwotIssues = entrada.swot.length;
  const development = totalSwotIssues
    ? clamp(30 + (entrada.swot.filter((s) => s.status === "Concluído").length / totalSwotIssues) * 69)
    : 50;

  const overall = clamp(
    (attack + defense + discipline + physical + mental + commitment + development) / 7,
  );

  return { overall, attack, defense, discipline, physical, mental, commitment, development, warnings };
}
