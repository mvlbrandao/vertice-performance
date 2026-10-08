"use client";

import { ReactNode, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { lockInertSiblings } from "@/lib/utils/inertLock";
import { lockBodyScroll } from "@/lib/utils/scrollLock";
import { keyboardInset, parseViewportBox } from "@/lib/utils/visualViewport";

/**
 * Área visível de verdade quando o teclado virtual está aberto.
 *
 * `vh` e `dvh` não acompanham o teclado: no iOS e no Android o teclado
 * encolhe só o "visual viewport", e a folha ancorada embaixo ficaria
 * escondida atrás dele, com o campo digitado fora da vista. Por isso lemos a
 * API visualViewport. O snapshot é uma string para o useSyncExternalStore
 * comparar por valor (um objeto novo a cada leitura causaria re-render sem
 * fim); vazio significa "sem teclado", e aí quem manda é o CSS (h-dvh).
 */
function subscribeViewport(onChange: () => void) {
  const vv = window.visualViewport;
  if (!vv) return () => {};
  vv.addEventListener("resize", onChange);
  vv.addEventListener("scroll", onChange);
  return () => {
    vv.removeEventListener("resize", onChange);
    vv.removeEventListener("scroll", onChange);
  };
}

function viewportSnapshot(): string {
  const vv = window.visualViewport;
  if (!vv) return "";
  return keyboardInset({
    layoutHeight: window.innerHeight,
    visualHeight: vv.height,
    visualOffsetTop: vv.offsetTop,
    scale: vv.scale,
  });
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  // A parte com hooks só existe enquanto aberto: a página tem dezenas de
  // modais montados e fechados, e cada um não deve ficar escutando o
  // visualViewport (nem disputando a trava de rolagem) à toa.
  if (!open) return null;
  return (
    <OpenModal onClose={onClose} title={title}>
      {children}
    </OpenModal>
  );
}

function OpenModal({
  onClose,
  title,
  children,
}: {
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const titleId = useId();
  const box = parseViewportBox(useSyncExternalStore(subscribeViewport, viewportSnapshot, () => ""));
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Quem tinha o foco ao abrir (o botão que abriu o modal). Lido no render e
  // não num efeito porque um campo com autoFocus já terá tomado o foco quando
  // o efeito rodar. Estado, e não ref, para valer o mesmo valor no modo estrito.
  const [trigger] = useState(() => document.activeElement);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Sem isto o dedo que rola a folha rola a página de trás.
  useEffect(() => lockBodyScroll(), []);

  // aria-modal só promete; o foco precisa ir para dentro, o resto da página
  // sair da ordem de tabulação e da leitura de tela, e o foco voltar a quem
  // abriu. O painel (e não o primeiro campo) recebe o foco: no celular focar um
  // campo levantaria o teclado antes de a pessoa ver o formulário.
  useEffect(() => {
    const overlay = overlayRef.current;
    const panel = panelRef.current;
    if (!overlay || !panel) return;

    const release = lockInertSiblings(overlay);
    if (!panel.contains(document.activeElement)) panel.focus({ preventScroll: true });

    return () => {
      // Antes do focus(): elemento inerte não aceita foco.
      release();
      // Painel ainda no DOM = o React só reexecuta o efeito (modo estrito em
      // desenvolvimento); fechar de verdade já o removeu. Devolver o foco ali
      // tiraria o foco de um campo com autoFocus, que o React não reaplica.
      if (panel.isConnected) return;
      // Se o gatilho sumiu (o botão desmonta ao salvar), não há para onde voltar.
      if (trigger instanceof HTMLElement && trigger.isConnected) {
        trigger.focus({ preventScroll: true });
      }
    };
  }, [trigger]);

  return createPortal(
    <div
      ref={overlayRef}
      // Até 639px o modal vira folha ancorada embaixo (alcance do polegar,
      // mais área útil); de sm para cima segue centralizado como antes.
      className="fixed inset-x-0 top-0 h-dvh bg-black/65 flex items-end sm:items-center justify-center z-50 p-0 sm:p-5"
      style={
        box ? { height: box.height, transform: `translateY(${box.offsetTop}px)` } : undefined
      }
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="bg-white outline-none w-full sm:max-w-[460px] max-h-[92%] sm:max-h-[88dvh] overflow-y-auto overscroll-contain rounded-t-lg sm:rounded-lg p-6.5 max-sm:pb-[max(1.625rem,env(safe-area-inset-bottom))] motion-safe:max-sm:animate-sheet-up"
      >
        <h3 id={titleId} className="text-[22px] mb-4 mt-0">
          {title}
        </h3>
        {children}
      </div>
    </div>,
    document.body,
  );
}
