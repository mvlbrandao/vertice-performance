/** Contato do suporte Vértice — mostrado quando o clube perde acesso e precisa falar com a gente. */
export const SUPPORT_WHATSAPP = "5583987509100";
export const SUPPORT_EMAIL = "mvlbrandao.br@gmail.com";

export function supportWhatsAppUrl(message: string): string {
  return `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(message)}`;
}

export function supportMailtoUrl(subject: string): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
