import type { HealthLevel, VitalTone } from "@/lib/platform/healthRules";

/**
 * Aparência de cada nível do semáforo. Cor NUNCA vai sozinha: cada nível tem
 * símbolo e texto, para quem não distingue verde de vermelho, no leitor de
 * tela e na impressão em preto e branco.
 *
 * Os tons escuros do texto (verde #1A6B3C, âmbar #7A6200, vermelho #B02020)
 * foram escolhidos para passar de 4,5:1 sobre o fundo claro do próprio selo.
 */
export const LEVEL_STYLE: Record<
  HealthLevel,
  { label: string; symbol: string; badge: string; text: string; border: string }
> = {
  ok: {
    label: "Normal",
    symbol: "✓",
    badge: "bg-[#E6F4EC] text-[#1A6B3C]",
    text: "text-[#1A6B3C]",
    border: "border-[#1A6B3C]",
  },
  atencao: {
    label: "Atenção",
    symbol: "!",
    badge: "bg-[#FFF3BF] text-[#7A6200]",
    text: "text-[#7A6200]",
    border: "border-[#C99A00]",
  },
  critico: {
    label: "Crítico",
    symbol: "✕",
    badge: "bg-[#FDE8E8] text-[#B02020]",
    text: "text-[#B02020]",
    border: "border-[#D72B2B]",
  },
  neutro: {
    label: "Sem dados",
    symbol: "–",
    badge: "bg-[#EEEEEE] text-ink-soft",
    text: "text-ink-soft",
    border: "border-line",
  },
};

export const TONE_LABEL: Record<VitalTone, string> = {
  bom: "Bom",
  atencao: "Atenção",
  ruim: "Ruim",
};

export const TONE_LEVEL: Record<VitalTone, HealthLevel> = {
  bom: "ok",
  atencao: "atencao",
  ruim: "critico",
};
