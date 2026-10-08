/**
 * Trava a rolagem da página enquanto um menu lateral ou modal está aberto.
 *
 * Contado por referência: o menu e um modal podem estar abertos juntos, e
 * quem fecha primeiro não pode destravar a página para o outro — por isso
 * só o último a soltar restaura o estilo original.
 *
 * Esconder a rolagem tira a barra e a página "pula" para o lado em desktop
 * com barra clássica; o padding compensa a largura que a barra ocupava.
 * Em celular a barra é sobreposta (largura 0) e a compensação some sozinha.
 */
export interface LockTarget {
  style: { overflow: string; paddingRight: string };
}

export function createScrollLock(
  getTarget: () => LockTarget | null,
  getGutterWidth: () => number = () => 0,
): () => () => void {
  let count = 0;
  let saved = { overflow: "", paddingRight: "" };

  return function lock() {
    const target = getTarget();
    if (!target) return () => {};

    if (count === 0) {
      saved = { overflow: target.style.overflow, paddingRight: target.style.paddingRight };
      const gutter = getGutterWidth();
      target.style.overflow = "hidden";
      if (gutter > 0) target.style.paddingRight = `${gutter}px`;
    }
    count += 1;

    let released = false;
    return () => {
      // Soltar duas vezes (ex.: efeito do React em modo estrito) não pode
      // descontar a trava de outro dono.
      if (released) return;
      released = true;
      count -= 1;
      if (count === 0) {
        target.style.overflow = saved.overflow;
        target.style.paddingRight = saved.paddingRight;
      }
    };
  };
}

export const lockBodyScroll = createScrollLock(
  () => (typeof document === "undefined" ? null : document.body),
  () =>
    typeof window === "undefined"
      ? 0
      : Math.max(0, window.innerWidth - document.documentElement.clientWidth),
);
