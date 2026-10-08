/**
 * Cliente Supabase falso, só para teste: guarda tabelas em memória, aplica os
 * filtros que o código do app usa e CONTA cada ida ao banco.
 *
 * Imita dois limites do PostgREST que já causaram bug silencioso aqui:
 * o corte de 1000 linhas por resposta (`maxRows`) e a URL longa demais
 * (`limiteDeUrl`, em caracteres somados das listas de `.in()`). Estourado o
 * limite de URL a consulta devolve `error`, como o servidor real.
 *
 * Cada `await` num builder conta como UMA consulta — é a unidade que importa
 * para medir N+1. Cobre só o subconjunto da API usado pelo score e pela
 * comparação entre atletas; método novo no app, método novo aqui.
 */

export type Linha = Record<string, unknown>;

export interface OpcoesFalso {
  /** Corte de linhas por resposta. Padrão do Supabase hospedado: 1000. */
  maxRows?: number;
  /** Soma máxima de caracteres das listas de `.in()` por consulta. */
  limiteDeUrl?: number;
}

export interface ConsultaRegistrada {
  tabela: string;
  /** Tamanho de cada lista passada a `.in()`. */
  listasIn: number[];
  faixa: [number, number] | null;
  limite: number | null;
  falhou: boolean;
  /**
   * Em qual "rodada" de idas ao banco a consulta começou: 1 + a rodada mais
   * alta já concluída quando ela partiu. Consultas disparadas juntas caem na
   * mesma rodada; uma que espera outra terminar cai na seguinte.
   */
  rodada: number;
}

interface Resposta {
  data: Linha[] | Linha | null;
  error: { message: string } | null;
  count?: number;
}

function comparar(a: unknown, b: unknown) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a ?? "").localeCompare(String(b ?? ""));
}

const URL_POR_ID = 39; // um UUID na querystring: ~36 caracteres + vírgula e folga

export function criarSupabaseFalso(
  tabelas: Record<string, Linha[]>,
  opcoes: OpcoesFalso = {},
) {
  const maxRows = opcoes.maxRows ?? 1000;
  const limiteDeUrl = opcoes.limiteDeUrl ?? Number.POSITIVE_INFINITY;
  const consultas: ConsultaRegistrada[] = [];
  const tabelasComErro = new Set<string>();
  let maiorRodadaConcluida = 0;

  function from(tabela: string) {
    const filtros: ((r: Linha) => boolean)[] = [];
    const registro: ConsultaRegistrada = {
      tabela,
      listasIn: [],
      faixa: null,
      limite: null,
      falhou: false,
      rodada: 0,
    };
    const ordens: { coluna: string; crescente: boolean }[] = [];
    let urlChars = 0;
    let umaLinha = false;
    let contar = false;
    let soContagem = false;

    const builder = {
      select(_colunas?: string, opcoesSelect?: { count?: string; head?: boolean }) {
        contar = !!opcoesSelect?.count;
        soContagem = !!opcoesSelect?.head;
        return builder;
      },
      eq(coluna: string, valor: unknown) {
        filtros.push((r) => r[coluna] === valor);
        return builder;
      },
      neq(coluna: string, valor: unknown) {
        filtros.push((r) => r[coluna] !== valor);
        return builder;
      },
      gte(coluna: string, valor: string | number) {
        filtros.push((r) => (r[coluna] as string | number) >= valor);
        return builder;
      },
      lte(coluna: string, valor: string | number) {
        filtros.push((r) => (r[coluna] as string | number) <= valor);
        return builder;
      },
      in(coluna: string, valores: unknown[]) {
        registro.listasIn.push(valores.length);
        urlChars += valores.length * URL_POR_ID;
        filtros.push((r) => valores.includes(r[coluna]));
        return builder;
      },
      not(coluna: string, operador: string, valor: unknown) {
        if (operador !== "is" || valor !== null) {
          throw new Error(`supabaseFalso: not(${coluna}, ${operador}) não suportado`);
        }
        filtros.push((r) => r[coluna] != null);
        return builder;
      },
      order(coluna: string, opcoesOrdem?: { ascending?: boolean }) {
        ordens.push({ coluna, crescente: opcoesOrdem?.ascending ?? true });
        return builder;
      },
      range(de: number, ate: number) {
        registro.faixa = [de, ate];
        return builder;
      },
      limit(n: number) {
        registro.limite = n;
        return builder;
      },
      /** Como o PostgREST: exatamente uma linha ou erro (e `data` vira objeto, não lista). */
      single() {
        umaLinha = true;
        return builder;
      },
      then<R1 = unknown, R2 = never>(
        resolver?: ((v: Resposta) => R1) | null,
        rejeitar?: ((e: unknown) => R2) | null,
      ) {
        consultas.push(registro);
        registro.rodada = maiorRodadaConcluida + 1;
        let resposta: Resposta;
        if (tabelasComErro.has(tabela)) {
          registro.falhou = true;
          resposta = { data: null, error: { message: `falha simulada em ${tabela}` } };
        } else if (urlChars > limiteDeUrl) {
          registro.falhou = true;
          resposta = { data: null, error: { message: "URI too long" } };
        } else {
          let linhas = (tabelas[tabela] ?? []).filter((r) => filtros.every((f) => f(r)));
          if (ordens.length > 0) {
            linhas = [...linhas].sort((a, b) => {
              for (const { coluna, crescente } of ordens) {
                const c = comparar(a[coluna], b[coluna]);
                if (c !== 0) return crescente ? c : -c;
              }
              return 0;
            });
          }
          const [de, ate] = registro.faixa ?? [0, Number.POSITIVE_INFINITY];
          let pedidas = linhas.slice(de, ate === Number.POSITIVE_INFINITY ? undefined : ate + 1);
          if (registro.limite !== null) pedidas = pedidas.slice(0, registro.limite);
          const lidas = pedidas.slice(0, maxRows);
          resposta = umaLinha
            ? lidas.length === 1
              ? { data: lidas[0], error: null }
              : { data: null, error: { message: `esperava 1 linha, veio ${lidas.length}` } }
            : { data: soContagem ? null : lidas, error: null };
          if (contar) resposta.count = linhas.length;
        }
        // Marca a conclusão antes de entregar o resultado: quem esperava esta
        // consulta e dispara outra em seguida cai na rodada seguinte.
        return Promise.resolve().then(() => {
          maiorRodadaConcluida = Math.max(maiorRodadaConcluida, registro.rodada);
          return resposta;
        }).then(resolver, rejeitar);
      },
    };
    return builder;
  }

  return {
    client: { from } as never,
    consultas,
    /** Quantas consultas foram feitas, no total ou numa tabela. */
    contar(tabela?: string) {
      return tabela ? consultas.filter((c) => c.tabela === tabela).length : consultas.length;
    },
    /**
     * Caminho crítico em idas sequenciais ao banco: quantas "rodadas" a tela
     * esperou, contando consultas paralelas como uma só.
     */
    rodadas() {
      return Math.max(0, ...consultas.map((c) => c.rodada));
    },
    /** Maior lista passada a um `.in()` em qualquer consulta. */
    maiorListaIn() {
      return Math.max(0, ...consultas.flatMap((c) => c.listasIn));
    },
    zerar() {
      consultas.length = 0;
    },
    /** Faz toda consulta à tabela devolver erro. */
    falharEm(tabela: string) {
      tabelasComErro.add(tabela);
    },
  };
}

/** PRNG determinístico (mulberry32): testes com dado "aleatório" sem flakiness. */
export function criarAleatorio(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Id estável e ordenável como texto: o n-ésimo vira ...0000n. */
export function idFalso(prefixo: string, n: number) {
  return `${prefixo}-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

const TIPOS_DE_EVENTO = [
  "Gol",
  "Assistência",
  "Finalização certa",
  "Finalização errada",
  "Desarme",
  "Interceptação",
  "Defesa",
  "Cartão amarelo",
  "Cartão vermelho",
  "Falta",
];
const POSICOES = ["Goleiro", "Fixo", "Ala", "Pivô", "Atacante"];

export interface OpcoesPlataforma {
  /** Quantos atletas ativos por clube e por categoria. */
  atletasPorCategoria: number;
  clubes: number;
  categorias: string[];
  /** Eventos de súmula por atleta (máximo; o real é sorteado até esse teto). */
  eventosPorAtleta?: number;
  semente?: number;
}

/**
 * Plataforma inteira em memória (todas as tabelas que o score lê), com dados
 * sorteados de forma determinística. Datas de jogo ficam em 2025 (passado)
 * para o teste não depender do dia em que roda.
 */
export function montarPlataforma(opcoes: OpcoesPlataforma) {
  const rnd = criarAleatorio(opcoes.semente ?? 7);
  const inteiro = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
  function escolhe<T>(lista: T[]): T {
    return lista[inteiro(0, lista.length - 1)];
  }

  const tabelas: Record<string, Linha[]> = {
    athletes: [],
    game_events: [],
    exercises: [],
    meetings: [],
    mental_notes: [],
    athlete_swot_items: [],
    game_lineups: [],
  };
  let seq = 0;
  const proximaId = (prefixo: string) => idFalso(prefixo, ++seq);

  for (let c = 1; c <= opcoes.clubes; c++) {
    const clubId = idFalso("c1ub0000", c);
    for (const categoria of opcoes.categorias) {
      for (let i = 0; i < opcoes.atletasPorCategoria; i++) {
        const athleteId = proximaId("a7e1e700");
        tabelas.athletes.push({
          id: athleteId,
          club_id: clubId,
          category: categoria,
          is_active: true,
          position: [escolhe(POSICOES)],
        });

        const jogos = Array.from({ length: inteiro(0, 8) }, (_, j) => ({
          id: proximaId("6a3e0000"),
          data: `2025-${String(inteiro(1, 12)).padStart(2, "0")}-${String(inteiro(1, 28)).padStart(2, "0")}`,
          ordem: j,
        }));
        for (const jogo of jogos) {
          tabelas.game_lineups.push({
            id: proximaId("1e0e0000"),
            athlete_id: athleteId,
            game_id: jogo.id,
            games: { scheduled_date: jogo.data },
          });
        }
        const nEventos = jogos.length ? inteiro(0, opcoes.eventosPorAtleta ?? 20) : 0;
        for (let e = 0; e < nEventos; e++) {
          tabelas.game_events.push({
            id: proximaId("e0e70000"),
            athlete_id: athleteId,
            game_id: escolhe(jogos).id,
            event_type: escolhe(TIPOS_DE_EVENTO),
          });
        }
        for (let e = 0, n = inteiro(0, 10); e < n; e++) {
          tabelas.exercises.push({ id: proximaId("e7e70000"), athlete_id: athleteId, done: rnd() < 0.6 });
        }
        for (let e = 0, n = inteiro(0, 6); e < n; e++) {
          tabelas.meetings.push({
            id: proximaId("3ee70000"),
            athlete_id: athleteId,
            status: rnd() < 0.2 ? "Cancelado" : "Agendado",
            athlete_confirmed: rnd() < 0.7,
          });
        }
        for (let e = 0, n = inteiro(0, 5); e < n; e++) {
          tabelas.mental_notes.push({
            id: proximaId("4e470000"),
            athlete_id: athleteId,
            confidence_score: rnd() < 0.2 ? null : inteiro(1, 10),
          });
        }
        for (let e = 0, n = inteiro(0, 5); e < n; e++) {
          tabelas.athlete_swot_items.push({
            id: proximaId("5a070000"),
            athlete_id: athleteId,
            category: escolhe(["Fraqueza", "Ameaça", "Força", "Oportunidade"]),
            status: escolhe(["Pendente", "Em andamento", "Concluído"]),
          });
        }
      }
    }
  }
  return tabelas;
}
