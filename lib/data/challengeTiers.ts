export const CHALLENGE_TIERS = ["Bronze", "Prata", "Ouro"] as const;
export type ChallengeTier = (typeof CHALLENGE_TIERS)[number];

export const CHALLENGE_TIER_DEFAULT_POINTS: Record<ChallengeTier, number> = {
  Bronze: 10,
  Prata: 20,
  Ouro: 30,
};

export const CHALLENGE_TIER_ICON: Record<ChallengeTier, string> = {
  Bronze: "🥉",
  Prata: "🥈",
  Ouro: "🥇",
};

export interface AthleteLevel {
  label: string;
  icon: string;
  color: string;
  nextThreshold: number | null;
}

const LEVEL_THRESHOLDS: { min: number; label: string; icon: string; color: string }[] = [
  { min: 500, label: "Diamante", icon: "💎", color: "#3D7EA6" },
  { min: 300, label: "Ouro", icon: "🥇", color: "#9A7A00" },
  { min: 150, label: "Prata", icon: "🥈", color: "#6B7280" },
  { min: 50, label: "Bronze", icon: "🥉", color: "#A15C2A" },
  { min: 0, label: "Iniciante", icon: "🌱", color: "#6B7280" },
];

export function athleteLevelFor(points: number): AthleteLevel {
  const idx = LEVEL_THRESHOLDS.findIndex((t) => points >= t.min);
  const current = LEVEL_THRESHOLDS[idx];
  const next = idx > 0 ? LEVEL_THRESHOLDS[idx - 1] : null;
  return {
    label: current.label,
    icon: current.icon,
    color: current.color,
    nextThreshold: next ? next.min : null,
  };
}
