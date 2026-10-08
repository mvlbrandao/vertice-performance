/**
 * Dinheiro digitado por gente, em reais, convertido para centavos inteiros.
 *
 * Existia uma versão em lib/actions/platformAdmin.ts que prometia aceitar
 * "149,90" e "149.90", mas apagava TODOS os pontos antes de converter: "149.90"
 * virava 14990 reais. O preço do plano é digitado ali, então o erro era de
 * 100 vezes e silencioso. Esta função é a única fonte da regra.
 *
 * Regras (pt-BR primeiro):
 * - "R$", espaços e espaço-sem-quebra são ignorados.
 * - Com vírgula: a ÚLTIMA vírgula é o decimal e os pontos são milhar
 *   ("1.499,90" = 149990; "149,9" = 14990).
 * - Sem vírgula e com ponto: três dígitos depois do ponto é milhar
 *   ("1.499" = 149900; "1.499.000"), um ou dois dígitos é decimal
 *   ("149.90" = 14990). Qualquer outra forma é recusada, não adivinhada.
 * - Negativo, letras ou mais de uma vírgula são recusados (null).
 *
 * A conta é feita em inteiros (parte inteira e fração separadas) para não
 * passar por ponto flutuante: 19,90 * 100 vale 1989.9999999999998 em JS.
 */

/** Teto de sanidade: R$ 1.000.000,00. Protege contra um zero a mais. */
export const MAX_CENTS = 100_000_000;

export function parseReaisToCents(raw: string): number | null {
  const limpo = raw
    .replace(/R\$/gi, "")
    .replace(/[\s ]/g, "");
  if (limpo === "") return null;
  if (!/^[0-9.,]+$/.test(limpo)) return null;

  let inteiro: string;
  let fracao = "";

  const virgulas = (limpo.match(/,/g) ?? []).length;
  if (virgulas > 1) return null;

  if (virgulas === 1) {
    const [esq, dir] = limpo.split(",");
    // pontos à esquerda da vírgula só podem ser separador de milhar
    if (esq.includes(".") && !/^\d{1,3}(\.\d{3})+$/.test(esq)) return null;
    if (dir.includes(".")) return null;
    if (dir.length > 2) return null;
    inteiro = esq.replace(/\./g, "");
    fracao = dir;
  } else if (limpo.includes(".")) {
    if (/^\d{1,3}(\.\d{3})+$/.test(limpo)) {
      inteiro = limpo.replace(/\./g, "");
    } else if (/^\d+\.\d{1,2}$/.test(limpo)) {
      [inteiro, fracao] = limpo.split(".");
    } else {
      return null;
    }
  } else {
    inteiro = limpo;
  }

  if (inteiro === "" || !/^\d+$/.test(inteiro)) return null;
  if (fracao !== "" && !/^\d+$/.test(fracao)) return null;

  const centavos = Number(inteiro) * 100 + Number(fracao.padEnd(2, "0") || "0");
  if (!Number.isSafeInteger(centavos) || centavos < 0 || centavos > MAX_CENTS) return null;
  return centavos;
}

/** "R$ 1.499,90". Sempre com duas casas e separador pt-BR, em qualquer ambiente. */
export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Valor para preencher um campo de texto ("1499,90"), sem símbolo nem milhar. */
export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",");
}
