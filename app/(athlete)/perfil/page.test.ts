import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const estado = vi.hoisted(() => ({
  cliente: null as unknown,
  getScoreChange: vi.fn(async () => null),
  getClubPeerClouds: vi.fn(async () => ({ categoryCloud: [], clubCloud: [] })),
  getSystemPercentile: vi.fn(async () => null),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({
  getSessionProfile: async () => ({
    userId: "user-1",
    email: null,
    clubId: "club-1",
    role: "athlete",
    fullName: "Atleta Teste",
    athleteId: "ath-1",
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => estado.cliente }));
vi.mock("@/lib/storage/resolveSignedUrl", () => ({ resolveSignedUrl: async () => null }));
vi.mock("@/lib/data/announcements", () => ({ getVisibleAnnouncements: async () => [] }));
vi.mock("@/lib/challengePoints", () => ({ getAthleteChallengePoints: async () => 0 }));
vi.mock("@/lib/scoreHistoryPoints", () => ({ getScoreHistory: async () => [] }));
vi.mock("@/lib/scoreHistory", () => ({ getScoreChange: estado.getScoreChange }));
vi.mock("@/lib/scouting/peerScoring", () => ({
  getClubPeerClouds: estado.getClubPeerClouds,
  getSystemPercentile: estado.getSystemPercentile,
}));

import AthletePerfilPage from "./page";
import { criarSupabaseFalso } from "@/lib/testing/supabaseFalso";

function montarAtleta() {
  return {
    athletes: [
      {
        id: "ath-1",
        club_id: "club-1",
        is_active: true,
        full_name: "Atleta Teste",
        category: "Sub-15",
        position: ["Atacante"],
        team: "Sub-15",
        photo_url: null,
        photo_color: "#111",
        current_pain: "Nenhuma",
      },
    ],
    game_events: [
      { id: "e1", athlete_id: "ath-1", game_id: "g1", event_type: "Gol" },
      { id: "e2", athlete_id: "ath-1", game_id: "g1", event_type: "Gol" },
    ],
  };
}

/** Elementos React são objetos simples: o JSON mostra o que a página montou. */
async function renderizarComoTexto() {
  return JSON.stringify(await AthletePerfilPage(), (chave, valor) =>
    chave.startsWith("_") || (chave === "type" && typeof valor !== "string") ? undefined : valor,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AthletePerfilPage: nota do próprio atleta", () => {
  it("com os dados lidos, mostra a nota e registra o snapshot a partir dela", async () => {
    estado.cliente = criarSupabaseFalso(montarAtleta()).client;

    const arvore = await renderizarComoTexto();

    expect(arvore).toContain('"overall":');
    expect(arvore).not.toContain("Não foi possível calcular sua nota");
    expect(estado.getScoreChange).toHaveBeenCalledTimes(1);
    expect(estado.getClubPeerClouds).toHaveBeenCalledTimes(1);
    expect(estado.getSystemPercentile).toHaveBeenCalledTimes(1);
  });

  it("se uma leitura do score falhar, NÃO grava snapshot nem inventa a nota neutra", async () => {
    const f = criarSupabaseFalso(montarAtleta());
    f.falharEm("game_events");
    estado.cliente = f.client;
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});

    const arvore = await renderizarComoTexto();

    // getScoreChange é quem insere o snapshot (e o "caiu de X para 57").
    expect(estado.getScoreChange).not.toHaveBeenCalled();
    // Sem nota própria não há com o que comparar.
    expect(estado.getClubPeerClouds).not.toHaveBeenCalled();
    expect(estado.getSystemPercentile).not.toHaveBeenCalled();

    expect(arvore).toContain("Não foi possível calcular sua nota agora");
    expect(arvore).not.toContain('"overall":');
    expect(erro).toHaveBeenCalledWith(expect.stringContaining("[perfil] nota indisponível"));
  });

  it("com a nota indisponível o resto da página continua de pé", async () => {
    const f = criarSupabaseFalso(montarAtleta());
    f.falharEm("game_events");
    estado.cliente = f.client;
    vi.spyOn(console, "error").mockImplementation(() => {});

    const arvore = await renderizarComoTexto();

    expect(arvore).toContain("Atleta Teste");
    expect(arvore).toContain("Próximos jogos");
    expect(arvore).toContain("Saúde & condição física");
    expect(arvore).toContain("Minha evolução no score");
  });
});
