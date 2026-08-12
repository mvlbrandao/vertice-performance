// Semeia as jogadas padrão de futsal (is_global = true), disponíveis pra
// todos os clubes. Roda direto contra o banco em vez de virar migration
// porque o conteúdo é dado de catálogo, não schema — e revisar diff de
// coordenada em SQL é ilegível.
//
// Idempotente: pula o que já existe pelo nome. Uso:
//   node scripts/seed-global-plays.mjs
//
// Construir o JSON à mão erra fácil — os ids precisam ser estáveis entre
// frames (a animação interpola marcador a marcador por id) e a bola precisa
// acompanhar quem está com ela. Daí os helpers abaixo.
import { readFileSync } from "node:fs";


/**
 * Um passo da jogada: posições de cada jogador, quem está com a bola e as
 * setas que anunciam o movimento do passo seguinte.
 */
function frame({ pos, ball, arrows = [] }) {
  const markers = Object.entries(pos).map(([id, p]) => ({
    id,
    kind: id.startsWith("o") ? "opponent" : "own",
    x: p[0],
    y: p[1],
    ...(id.startsWith("o") ? {} : { label: id === "g" ? "G" : id.replace("p", "") }),
  }));
  // A bola pode estar num jogador (string) ou solta numa coordenada.
  const b = typeof ball === "string" ? pos[ball] : ball;
  markers.push({ id: "ball", kind: "ball", x: b[0], y: b[1] });
  return {
    markers,
    arrows: arrows.map((a, i) => ({
      id: `a${i + 1}`,
      x1: a[0],
      y1: a[1],
      x2: a[2],
      y2: a[3],
      ...(a[4] ? { dashed: true } : {}),
    })),
  };
}

const plays = [];

// ─────────────────────────────────────────────────────────────────────────
plays.push({
  name: "Bloqueio pro ala (cortina)",
  tags: ["Bloqueio", "Finalização"],
  description:
    "O pivô sobe pra travar o marcador do ala, que ganha o espaço de um passo pra entrar e finalizar. É a jogada que mais rende contra marcação individual: em vez de driblar, o ala usa o corpo do companheiro como obstáculo. O bloqueio tem que ser parado — se o pivô se mexe no contato, é falta.",
  frames: [
    frame({
      pos: {
        g: [40, 190], p2: [180, 190], p3: [300, 80], p4: [300, 300], p5: [470, 190],
        o1: [225, 190], o2: [335, 88], o3: [335, 300], o4: [500, 195],
      },
      ball: "p2",
      arrows: [[195, 182, 288, 92]],
    }),
    frame({
      pos: {
        g: [40, 190], p2: [200, 200], p3: [300, 80], p4: [300, 300], p5: [470, 190],
        o1: [245, 200], o2: [335, 88], o3: [335, 300], o4: [500, 195],
      },
      ball: "p3",
      arrows: [[458, 182, 372, 112]],
    }),
    frame({
      pos: {
        g: [40, 190], p2: [200, 200], p3: [300, 80], p4: [310, 300], p5: [360, 105],
        o1: [245, 200], o2: [335, 92], o3: [345, 300], o4: [480, 200],
      },
      ball: "p3",
      arrows: [[312, 92, 396, 148]],
    }),
    frame({
      pos: {
        g: [40, 190], p2: [210, 200], p3: [405, 155], p4: [330, 300], p5: [355, 100],
        o1: [255, 200], o2: [340, 95], o3: [360, 300], o4: [470, 205],
      },
      ball: "p3",
      arrows: [[420, 165, 578, 190, true]],
    }),
    frame({
      pos: {
        g: [40, 190], p2: [210, 200], p3: [425, 168], p4: [340, 300], p5: [355, 100],
        o1: [255, 200], o2: [345, 100], o3: [370, 300], o4: [470, 205],
      },
      ball: [582, 190],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────────
plays.push({
  name: "Dá e vai com o pivô (parede)",
  tags: ["Tabela", "Infiltração"],
  description:
    "O fixo toca no pivô de costas e arranca sem esperar. O pivô devolve de primeira, no espaço, e quem entra recebe já de frente pro gol. Só funciona se a corrida começar junto com o passe: se o fixo passa e fica olhando, a defesa recompõe e a parede vira posse estéril.",
  frames: [
    frame({
      pos: {
        g: [40, 190], p2: [200, 190], p3: [290, 80], p4: [290, 300], p5: [450, 190],
        o1: [245, 190], o2: [325, 85], o3: [325, 300], o4: [485, 195],
      },
      ball: "p2",
      arrows: [[216, 190, 432, 190]],
    }),
    frame({
      pos: {
        g: [40, 190], p2: [200, 190], p3: [290, 80], p4: [290, 300], p5: [450, 190],
        o1: [245, 190], o2: [325, 85], o3: [325, 300], o4: [485, 195],
      },
      ball: "p5",
      arrows: [[212, 180, 368, 122]],
    }),
    frame({
      pos: {
        g: [40, 190], p2: [380, 130], p3: [300, 75], p4: [300, 300], p5: [450, 190],
        o1: [290, 175], o2: [335, 82], o3: [335, 300], o4: [480, 198],
      },
      ball: "p5",
      arrows: [[437, 178, 396, 140]],
    }),
    frame({
      pos: {
        g: [40, 190], p2: [385, 132], p3: [305, 72], p4: [310, 300], p5: [455, 200],
        o1: [305, 168], o2: [340, 80], o3: [345, 300], o4: [478, 205],
      },
      ball: "p2",
      arrows: [[400, 138, 578, 178, true]],
    }),
    frame({
      pos: {
        g: [40, 190], p2: [402, 140], p3: [312, 70], p4: [318, 300], p5: [455, 205],
        o1: [318, 162], o2: [345, 78], o3: [352, 300], o4: [478, 208],
      },
      ball: [582, 178],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────────
plays.push({
  name: "Rotação em oito (três jogadores)",
  tags: ["Rotação", "Marcação individual"],
  description:
    "Fixo e os dois alas giram num circuito em forma de oito, sem parar. Contra marcação individual, o marcador é obrigado a correr atrás ou trocar — e é na troca que abre a linha de passe pro pivô. Na base é o melhor exercício pra ensinar movimentação sem bola: ninguém fica parado esperando a bola chegar.",
  frames: [
    frame({
      pos: {
        g: [40, 190], p2: [190, 190], p3: [320, 90], p4: [320, 290], p5: [470, 190],
        o1: [235, 190], o2: [355, 92], o3: [355, 290], o4: [500, 195],
      },
      ball: "p2",
      arrows: [[320, 108, 210, 178], [206, 178, 316, 272]],
    }),
    frame({
      pos: {
        g: [40, 190], p2: [265, 240], p3: [255, 140], p4: [320, 290], p5: [470, 190],
        o1: [285, 235], o2: [300, 135], o3: [355, 290], o4: [500, 195],
      },
      ball: "p2",
      arrows: [[210, 145, 318, 88], [320, 272, 212, 200]],
    }),
    frame({
      pos: {
        g: [40, 190], p2: [320, 290], p3: [200, 155], p4: [250, 230], p5: [470, 190],
        o1: [340, 285], o2: [245, 150], o3: [292, 228], o4: [500, 195],
      },
      ball: "p2",
      arrows: [[212, 222, 316, 282], [336, 282, 452, 200]],
    }),
    frame({
      pos: {
        g: [40, 190], p2: [325, 285], p3: [190, 190], p4: [310, 95], p5: [470, 195],
        o1: [352, 278], o2: [232, 188], o3: [345, 100], o4: [508, 205],
      },
      ball: "p2",
      arrows: [[340, 275, 452, 205]],
    }),
    frame({
      pos: {
        g: [40, 190], p2: [330, 280], p3: [195, 190], p4: [315, 95], p5: [468, 200],
        o1: [358, 272], o2: [236, 188], o3: [350, 100], o4: [512, 212],
      },
      ball: "p5",
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────────
plays.push({
  name: "Saída em 4-0 com infiltração",
  tags: ["Saída de bola", "Construção"],
  description:
    "Os quatro de linha ficam alinhados, sem pivô fixo. A defesa não tem referência pra marcar e precisa subir; a cada passe lateral, um jogador do lado oposto ataca as costas do marcador. É a estrutura que mais ensina a ler o momento de entrar — o gatilho é o passe cruzar a quadra, nunca antes.",
  frames: [
    frame({
      pos: {
        g: [45, 190], p2: [230, 100], p3: [230, 280], p4: [330, 100], p5: [330, 280],
        o1: [285, 105], o2: [285, 275], o3: [390, 105], o4: [390, 275],
      },
      ball: "p2",
      arrows: [[232, 118, 232, 262]],
    }),
    frame({
      pos: {
        g: [45, 190], p2: [230, 100], p3: [235, 280], p4: [330, 100], p5: [330, 280],
        o1: [285, 110], o2: [288, 272], o3: [390, 108], o4: [392, 272],
      },
      ball: "p3",
      arrows: [[335, 118, 440, 175]],
    }),
    frame({
      pos: {
        g: [45, 190], p2: [235, 105], p3: [235, 280], p4: [445, 180], p5: [335, 280],
        o1: [292, 118], o2: [292, 270], o3: [400, 130], o4: [398, 268],
      },
      ball: "p3",
      arrows: [[250, 268, 430, 190]],
    }),
    frame({
      pos: {
        g: [45, 190], p2: [240, 108], p3: [240, 282], p4: [455, 190], p5: [340, 278],
        o1: [296, 122], o2: [296, 272], o3: [412, 148], o4: [404, 266],
      },
      ball: "p4",
      arrows: [[468, 190, 580, 190, true]],
    }),
    frame({
      pos: {
        g: [45, 190], p2: [242, 110], p3: [242, 282], p4: [468, 190], p5: [345, 275],
        o1: [298, 124], o2: [298, 272], o3: [420, 158], o4: [408, 264],
      },
      ball: [584, 190],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────────
plays.push({
  name: "Marcação em losango (1-2-1)",
  tags: ["Marcação", "Pressão"],
  description:
    "Defesa em losango: um jogador pressiona a bola, dois fecham as laterais e o último cobre o meio. Direciona o adversário pra linha lateral, onde o espaço acaba. O erro clássico da base é o vértice de frente sair correndo sozinho — ele encurta, não desarma; quem ganha a bola é quem está do lado.",
  frames: [
    frame({
      pos: {
        g: [40, 190], p2: [155, 190], p3: [255, 115], p4: [255, 265], p5: [370, 190],
        o1: [470, 190], o2: [340, 95], o3: [340, 285], o4: [530, 190],
      },
      ball: "o1",
      arrows: [[382, 190, 448, 190]],
    }),
    frame({
      pos: {
        g: [40, 190], p2: [165, 190], p3: [265, 118], p4: [265, 262], p5: [448, 190],
        o1: [470, 190], o2: [340, 95], o3: [340, 285], o4: [530, 190],
      },
      ball: "o1",
      arrows: [[462, 180, 362, 108]],
    }),
    frame({
      pos: {
        g: [40, 190], p2: [175, 190], p3: [285, 120], p4: [275, 258], p5: [450, 195],
        o1: [468, 195], o2: [348, 98], o3: [345, 285], o4: [528, 195],
      },
      ball: "o2",
      arrows: [[298, 122, 336, 100], [462, 188, 400, 132]],
    }),
    frame({
      pos: {
        g: [40, 190], p2: [190, 185], p3: [330, 102], p4: [285, 252], p5: [405, 135],
        o1: [455, 175], o2: [352, 98], o3: [350, 285], o4: [522, 200],
      },
      ball: "o2",
      arrows: [[340, 100, 210, 178, true]],
    }),
    frame({
      pos: {
        g: [40, 190], p2: [215, 180], p3: [335, 100], p4: [292, 248], p5: [400, 130],
        o1: [450, 172], o2: [356, 100], o3: [352, 285], o4: [518, 202],
      },
      ball: "p3",
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────────
plays.push({
  name: "Reposição rápida do goleiro",
  tags: ["Transição", "Contra-ataque"],
  description:
    "Defendeu, olha pra frente antes de dominar. Enquanto o adversário volta, o goleiro lança no ala que já arrancou pela lateral livre. A janela é curta: se a bola demora dois toques na mão do goleiro, ela fechou. Vale treinar o gatilho — o ala arranca no momento da defesa, não depois.",
  frames: [
    frame({
      pos: {
        g: [50, 190], p2: [175, 200], p3: [230, 90], p4: [230, 295], p5: [370, 190],
        o1: [300, 175], o2: [340, 265], o3: [415, 130], o4: [430, 250],
      },
      ball: "g",
      arrows: [[240, 82, 400, 62]],
    }),
    frame({
      pos: {
        g: [50, 190], p2: [180, 200], p3: [405, 62], p4: [235, 295], p5: [372, 190],
        o1: [290, 182], o2: [330, 268], o3: [400, 140], o4: [420, 252],
      },
      ball: "g",
      arrows: [[66, 186, 392, 66]],
    }),
    frame({
      pos: {
        g: [50, 190], p2: [190, 200], p3: [410, 62], p4: [270, 292], p5: [385, 195],
        o1: [275, 190], o2: [310, 272], o3: [378, 152], o4: [402, 258],
      },
      ball: "p3",
      arrows: [[398, 195, 500, 235], [424, 74, 512, 118]],
    }),
    frame({
      pos: {
        g: [50, 190], p2: [215, 198], p3: [518, 120], p4: [305, 288], p5: [505, 238],
        o1: [265, 195], o2: [292, 275], o3: [420, 175], o4: [455, 262],
      },
      ball: "p3",
      arrows: [[522, 135, 520, 218]],
    }),
    frame({
      pos: {
        g: [50, 190], p2: [225, 196], p3: [524, 126], p4: [318, 285], p5: [512, 232],
        o1: [262, 196], o2: [286, 276], o3: [438, 182], o4: [470, 258],
      },
      ball: "p5",
      arrows: [[526, 228, 584, 196, true]],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────────
plays.push({
  name: "Escanteio com bloqueio no primeiro pau",
  tags: ["Bola parada", "Escanteio"],
  description:
    "Dois jogadores se cruzam na entrada da pequena área: o da frente segura o marcador do companheiro, que sai livre no primeiro pau. A bola vem tensa e rasteira, na altura do joelho — não é cruzamento pra cabeça. Quem finaliza só precisa desviar a direção.",
  frames: [
    frame({
      pos: {
        g: [40, 190], p2: [420, 118], p3: [598, 40], p4: [462, 262], p5: [470, 190],
        o1: [455, 130], o2: [498, 190], o3: [488, 258], o4: [560, 175],
      },
      ball: "p3",
      arrows: [[478, 190, 442, 152]],
    }),
    frame({
      pos: {
        g: [40, 190], p2: [425, 120], p3: [598, 40], p4: [462, 262], p5: [445, 155],
        o1: [455, 132], o2: [488, 178], o3: [488, 258], o4: [560, 175],
      },
      ball: "p3",
      arrows: [[432, 128, 520, 96]],
    }),
    frame({
      pos: {
        g: [40, 190], p2: [522, 96], p3: [598, 42], p4: [466, 258], p5: [442, 150],
        o1: [462, 140], o2: [482, 172], o3: [490, 255], o4: [556, 172],
      },
      ball: "p3",
      arrows: [[590, 52, 534, 92]],
    }),
    frame({
      pos: {
        g: [40, 190], p2: [532, 94], p3: [596, 48], p4: [470, 255], p5: [440, 148],
        o1: [468, 146], o2: [478, 168], o3: [492, 252], o4: [552, 170],
      },
      ball: "p2",
      arrows: [[540, 100, 588, 178, true]],
    }),
    frame({
      pos: {
        g: [40, 190], p2: [538, 98], p3: [594, 52], p4: [472, 252], p5: [438, 146],
        o1: [470, 150], o2: [476, 166], o3: [494, 250], o4: [550, 168],
      },
      ball: [590, 178],
    }),
  ],
});

// ─────────────────────────────────────────────────────────────────────────
plays.push({
  name: "Bloqueio duplo na entrada da área",
  tags: ["Bloqueio", "Finalização"],
  description:
    "Dois jogadores formam uma porta na entrada da área e o ala passa entre eles com a bola. Contra troca de marcação, um dos dois bloqueadores sempre sobra: se a defesa troca, o bloqueador de dentro gira e recebe; se não troca, quem passa fica livre pro chute. Ler qual das duas aconteceu é a parte que se treina.",
  frames: [
    frame({
      pos: {
        g: [40, 190], p2: [215, 190], p3: [325, 300], p4: [400, 148], p5: [400, 232],
        o1: [262, 190], o2: [360, 300], o3: [432, 142], o4: [432, 238],
      },
      ball: "p2",
      arrows: [[232, 198, 312, 288]],
    }),
    frame({
      pos: {
        g: [40, 190], p2: [225, 195], p3: [325, 300], p4: [400, 148], p5: [400, 232],
        o1: [268, 196], o2: [360, 300], o3: [432, 142], o4: [432, 238],
      },
      ball: "p3",
      arrows: [[338, 288, 402, 200]],
    }),
    frame({
      pos: {
        g: [40, 190], p2: [235, 198], p3: [405, 198], p4: [400, 148], p5: [400, 240],
        o1: [278, 205], o2: [388, 258], o3: [434, 140], o4: [438, 246],
      },
      ball: "p3",
      arrows: [[420, 194, 500, 186]],
    }),
    frame({
      pos: {
        g: [40, 190], p2: [248, 200], p3: [505, 186], p4: [398, 145], p5: [398, 242],
        o1: [292, 212], o2: [402, 268], o3: [436, 138], o4: [440, 250],
      },
      ball: "p3",
      arrows: [[518, 186, 586, 190, true]],
    }),
    frame({
      pos: {
        g: [40, 190], p2: [255, 202], p3: [518, 188], p4: [396, 143], p5: [396, 244],
        o1: [300, 216], o2: [408, 272], o3: [438, 137], o4: [442, 252],
      },
      ball: [590, 190],
    }),
  ],
});


// ── validação: erra aqui em vez de gerar animação quebrada em produção ──
for (const p of plays) {
  const idSets = new Set(p.frames.map((f) => f.markers.map((m) => m.id).sort().join(",")));
  if (idSets.size !== 1) throw new Error(`${p.name}: ids de marcador mudam entre quadros`);
  for (const [i, f] of p.frames.entries()) {
    for (const m of f.markers) {
      if (m.x < 0 || m.x > 600 || m.y < 0 || m.y > 380) {
        throw new Error(`${p.name} quadro ${i + 1}: ${m.id} fora da quadra`);
      }
    }
  }
}

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);
const BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!BASE || !KEY) throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY em .env.local");

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

const existing = await fetch(`${BASE}/rest/v1/plays?is_global=eq.true&select=name,created_by`, { headers })
  .then((r) => r.json());
const known = new Set(existing.map((p) => p.name));
const owner = existing[0]?.created_by;
if (!owner) throw new Error("Nenhuma jogada global no banco pra herdar created_by — semeie a primeira manualmente");

const novas = plays.filter((p) => !known.has(p.name));
if (novas.length === 0) {
  console.log("Nada a fazer: todas as jogadas já estão no banco.");
  process.exit(0);
}

const res = await fetch(`${BASE}/rest/v1/plays`, {
  method: "POST",
  headers: { ...headers, Prefer: "return=representation" },
  body: JSON.stringify(
    novas.map((p) => ({
      club_id: null,
      created_by: owner,
      name: p.name,
      target_type: "team",
      sport_type: "futsal",
      tags: p.tags,
      description: p.description,
      frames: p.frames,
      is_global: true,
    })),
  ),
});
if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
const inseridas = await res.json();
console.log(`${inseridas.length} jogadas inseridas:`);
for (const p of inseridas) console.log(` - ${p.name}`);
