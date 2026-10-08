/**
 * Contas do teclado virtual sobre a visualViewport. Separadas do componente
 * para serem testáveis sem navegador.
 */

export interface ViewportReading {
  /** window.innerHeight: o layout, que o teclado não encolhe no iOS/Android. */
  layoutHeight: number;
  /** visualViewport.height: a parte realmente visível. */
  visualHeight: number;
  /** visualViewport.offsetTop: quanto o iOS rolou a área visível para revelar o campo. */
  visualOffsetTop: number;
  /** visualViewport.scale: >1 quando a pessoa deu zoom de pinça. */
  scale: number;
}

/**
 * Abaixo disto a diferença é a barra do navegador aparecendo/sumindo, não um
 * teclado (que ocupa de ~200px para cima). Sem o limite, rolar a página
 * faria a folha tremer a cada barra que entra e sai.
 */
const KEYBOARD_MIN_PX = 120;

/**
 * Serializa a área visível quando há teclado aberto; "" quando não há.
 * String, e não objeto, porque useSyncExternalStore compara o snapshot por
 * identidade: um objeto novo a cada leitura re-renderizaria sem parar.
 */
export function keyboardInset(r: ViewportReading): string {
  // Zoom de pinça também encolhe a área visível, mas isso não é teclado e a
  // folha não deve se mexer por causa dele.
  if (r.scale > 1.01) return "";
  if (r.layoutHeight - r.visualHeight < KEYBOARD_MIN_PX) return "";
  return `${Math.round(r.visualHeight)}|${Math.round(r.visualOffsetTop)}`;
}

export function parseViewportBox(
  snapshot: string,
): { height: number; offsetTop: number } | null {
  if (!snapshot) return null;
  const [height, offsetTop] = snapshot.split("|").map(Number);
  if (!Number.isFinite(height) || !Number.isFinite(offsetTop)) return null;
  return { height, offsetTop };
}
