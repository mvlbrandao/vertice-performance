import type { PlayerScore } from "@/lib/scoring";
import { overallColor, scoreStars } from "@/lib/utils/scoreColor";

const ATTRIBUTES: { key: keyof Omit<PlayerScore, "overall">; abbr: string; label: string }[] = [
  { key: "attack", abbr: "ATA", label: "Ataque" },
  { key: "defense", abbr: "DEF", label: "Defesa" },
  { key: "physical", abbr: "FÍS", label: "Físico" },
  { key: "mental", abbr: "MEN", label: "Mental" },
  { key: "discipline", abbr: "DIS", label: "Disciplina" },
  { key: "commitment", abbr: "COM", label: "Compromisso" },
  { key: "development", abbr: "DES", label: "Desenvolvimento" },
];

export function PlayerScoreCard({
  score,
  photoUrl,
  photoColor,
  initials,
  fullName,
  position,
}: {
  score: PlayerScore;
  photoUrl: string | null;
  photoColor: string | null;
  initials: string;
  fullName: string;
  position: string | null;
}) {
  return (
    <div className="rounded-lg bg-pitch-dark text-chalk p-4 flex gap-4 items-center flex-wrap">
      <div className="flex flex-col items-center gap-1.5 shrink-0">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center font-display text-xl border-2"
          style={{ borderColor: overallColor(score.overall), color: overallColor(score.overall) }}
        >
          {score.overall}
        </div>
        <span className="text-xs leading-none" style={{ color: overallColor(score.overall) }}>
          {"★".repeat(scoreStars(score.overall))}
          {"☆".repeat(3 - scoreStars(score.overall))}
        </span>
        <span className="text-[10px] text-white/50 uppercase tracking-wide">Geral</span>
      </div>
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={fullName}
          className="w-14 h-14 rounded-lg object-cover shrink-0 border-2 border-amber"
        />
      ) : (
        <div
          className="w-14 h-14 rounded-lg flex items-center justify-center font-display text-xl shrink-0 border-2 border-amber"
          style={{ background: photoColor ?? "#111", color: "#FFD600" }}
        >
          {initials}
        </div>
      )}
      <div className="flex-1 min-w-[200px]">
        <b className="block text-sm truncate">{fullName}</b>
        {position && <span className="text-xs text-white/60">{position}</span>}
        <div className="grid grid-cols-3 gap-x-3 gap-y-1 mt-2">
          {ATTRIBUTES.map((a) => (
            <div key={a.key} className="flex items-center gap-1.5">
              <span className="text-[10.5px] font-bold text-amber w-8 shrink-0">{a.abbr}</span>
              <span className="text-[11px] font-mono">{score[a.key]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
