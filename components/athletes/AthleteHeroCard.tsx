import type { PlayerScore } from "@/lib/scoring";
import { Badge } from "@/components/ui/Badge";
import { overallColor, scoreStars } from "@/lib/utils/scoreColor";
import { athleteLevelFor } from "@/lib/data/challengeTiers";

const ATTRIBUTES: { key: keyof Omit<PlayerScore, "overall" | "warnings">; abbr: string }[] = [
  { key: "attack", abbr: "ATA" },
  { key: "defense", abbr: "DEF" },
  { key: "physical", abbr: "FÍS" },
  { key: "mental", abbr: "MEN" },
  { key: "discipline", abbr: "DIS" },
  { key: "commitment", abbr: "COM" },
  { key: "development", abbr: "DES" },
];

/**
 * Card único de identidade do atleta: junta o que antes eram dois cards
 * separados (dados pessoais e card estilo FIFA), que repetiam foto, nome e
 * posição um do outro.
 */
export function AthleteHeroCard({
  score,
  photoUrl,
  photoColor,
  initials,
  fullName,
  category,
  positions,
  team,
  heightCm,
  weightKg,
  bmi,
  challengePoints,
}: {
  score: PlayerScore;
  photoUrl: string | null;
  photoColor: string | null;
  initials: string;
  fullName: string;
  category: string | null;
  positions: string[] | null;
  team: string | null;
  heightCm: number | null;
  weightKg: number | null;
  bmi: number | null;
  challengePoints?: number;
}) {
  const level = challengePoints != null ? athleteLevelFor(challengePoints) : null;
  const color = overallColor(score.overall);

  return (
    <div className="rounded-lg bg-pitch-dark text-chalk p-4 sm:p-5 mb-4.5">
      {/*
        Sem flex-wrap aqui de propósito: no celular o score é o que o atleta
        abre o app pra ver, e deixá-lo quebrar pra linha de baixo jogava o
        número pro canto esquerdo com meia tela vazia do lado. Foto, nome e
        score dividem a mesma linha em qualquer largura; o que cede é o
        espaço do nome (min-w-0 permite encolher).
      */}
      <div className="flex gap-3 sm:gap-4 items-center">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt={fullName}
            className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-xl object-cover shrink-0 border-2 border-amber"
          />
        ) : (
          <div
            className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-xl flex items-center justify-center font-display text-2xl sm:text-[28px] shrink-0 border-2 border-amber"
            style={{ background: photoColor ?? "#111", color: "#FFD600" }}
          >
            {initials}
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h2 className="m-0 font-sans text-[17px] sm:text-xl font-extrabold leading-tight break-words">
            {fullName}
          </h2>
          {level && (
            <span
              className="inline-block mt-1 text-[10.5px] font-bold px-1.5 py-0.5 rounded-sm border"
              style={{ borderColor: level.color, color: level.color }}
              title={`${challengePoints} pontos de desafio`}
            >
              {level.icon} {level.label}
            </span>
          )}
        </div>

        <div className="flex flex-col items-center gap-1 shrink-0">
          <div
            className="w-[52px] h-[52px] sm:w-14 sm:h-14 rounded-full flex items-center justify-center font-display text-xl sm:text-[22px] border-2"
            style={{ borderColor: color, color }}
          >
            {score.overall}
          </div>
          <span className="text-xs leading-none" style={{ color }}>
            {"★".repeat(scoreStars(score.overall))}
            {"☆".repeat(3 - scoreStars(score.overall))}
          </span>
          <span className="text-[10px] text-white/50 uppercase tracking-wide">Geral</span>
        </div>
      </div>

      {/* Categoria, posições e time ocupam a largura toda: espremidos ao lado
          do nome, quebravam em três linhas num celular. */}
      <div className="flex gap-1.5 flex-wrap mt-3">
        {category && <Badge tone="green">{category}</Badge>}
        {positions?.map((p) => (
          <Badge key={p} tone="amber">
            {p}
          </Badge>
        ))}
        {team && <Badge tone="sky">{team}</Badge>}
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-x-2 sm:gap-x-3 gap-y-2 mt-3.5 pt-3.5 border-t border-white/10">
        {ATTRIBUTES.map((a) => (
          <div key={a.key} className="flex items-center gap-1.5">
            <span className="text-[10.5px] font-bold text-amber w-7 sm:w-8 shrink-0">{a.abbr}</span>
            <span className="text-[12.5px] font-mono">{score[a.key]}</span>
          </div>
        ))}
      </div>

      <div className="flex gap-8 sm:gap-6 mt-3.5 pt-3.5 border-t border-white/10">
        <div>
          <b className="font-mono text-base block">{heightCm ? `${heightCm}cm` : "—"}</b>
          <span className="text-[10.5px] text-white/50 uppercase tracking-wide">Altura</span>
        </div>
        <div>
          <b className="font-mono text-base block">{weightKg ? `${weightKg}kg` : "—"}</b>
          <span className="text-[10.5px] text-white/50 uppercase tracking-wide">Peso</span>
        </div>
        <div>
          <b className="font-mono text-base block">{bmi ?? "—"}</b>
          <span className="text-[10.5px] text-white/50 uppercase tracking-wide">IMC</span>
        </div>
      </div>
    </div>
  );
}
