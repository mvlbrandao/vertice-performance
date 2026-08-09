import type { SwotCategory } from "@/lib/types/database";

export const SWOT_CATEGORIES: SwotCategory[] = ["Força", "Fraqueza", "Oportunidade", "Ameaça"];

export const SWOT_CATEGORY_META: Record<
  SwotCategory,
  { icon: string; tone: "green" | "clay" | "sky" | "amber" }
> = {
  Força: { icon: "💪", tone: "green" },
  Fraqueza: { icon: "🎯", tone: "clay" },
  Oportunidade: { icon: "🌱", tone: "sky" },
  Ameaça: { icon: "⚠️", tone: "amber" },
};
