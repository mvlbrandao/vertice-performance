/**
 * Isola o resto da página enquanto um modal está aberto.
 *
 * `aria-modal` só avisa; quem impede o Tab, o leitor de tela e o toque de
 * alcançar o que está atrás do fundo escurecido é o `inert`. Marcamos os
 * irmãos do modal (filhos do <body>), em vez de prender o Tab com uma lista de
 * elementos focáveis, que erra com rádio, campo oculto e conteúdo que muda.
 *
 * Contado por elemento, como a trava de rolagem: um modal aberto por cima de
 * outro isola o primeiro, e soltar um não pode reabilitar o que o outro ainda
 * precisa isolado, em qualquer ordem de fechamento. Quem já estava `inert` por
 * outro motivo não é tocado, nem liberado depois.
 */
export interface InertTarget {
  inert: boolean;
}

export function createInertLock<T extends InertTarget>(
  getCandidates: () => Iterable<T>,
): (keep: T) => () => void {
  // Só o que esta trava tornou inerte, com quantos modais dependem disso.
  const owned = new Map<T, number>();

  return function lock(keep: T) {
    const mine: T[] = [];
    for (const el of getCandidates()) {
      if (el === keep) continue;
      const count = owned.get(el);
      if (count !== undefined) {
        owned.set(el, count + 1);
        mine.push(el);
      } else if (!el.inert) {
        el.inert = true;
        owned.set(el, 1);
        mine.push(el);
      }
    }

    let released = false;
    return () => {
      // Soltar duas vezes (efeito do React em modo estrito) não pode
      // descontar a trava de outro modal.
      if (released) return;
      released = true;
      for (const el of mine) {
        const count = (owned.get(el) ?? 1) - 1;
        if (count > 0) {
          owned.set(el, count);
        } else {
          owned.delete(el);
          el.inert = false;
        }
      }
    };
  };
}

/** Marca como inertes os demais filhos do <body>, menos `keep` (o fundo do modal). */
export const lockInertSiblings = createInertLock<HTMLElement>(() =>
  typeof document === "undefined"
    ? []
    : Array.from(document.body.children).filter((el): el is HTMLElement => el instanceof HTMLElement),
);
