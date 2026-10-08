"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { overflowEdges, scrollLeftToCenter } from "@/lib/utils/scrollTabs";

/**
 * Faixa de abas que rola na horizontal em tela estreita.
 *
 * Resolve duas falhas de uma faixa `overflow-x-auto` pura: (1) sem pista
 * visual, ninguém percebe que existem mais abas além da borda; (2) ao abrir
 * uma aba do fim da lista, ela continua escondida fora da tela. Aqui a aba
 * ativa é trazida para o centro e uma sombra nas bordas indica de que lado
 * ainda há abas.
 *
 * A aba ativa é achada por `aria-current="page"` (links) ou
 * `aria-selected="true"` (botões de aba) — quem usa só precisa marcar isso,
 * que já é o que leitores de tela esperam.
 *
 * O estado da sombra vai direto em atributos data-* do DOM, sem useState:
 * muda a cada pixel de rolagem e não há motivo para re-renderizar o React
 * por isso.
 */
export function ScrollableTabs({
  activeKey,
  label,
  role,
  fade = "chalk",
  className,
  children,
}: {
  /** Muda quando a aba ativa muda (ex.: pathname); dispara o recentralizar. */
  activeKey: string;
  label: string;
  /** "navigation" para links de página; "tablist" para abas que trocam conteúdo no lugar. */
  role?: "navigation" | "tablist";
  /** Cor do fundo atrás da faixa, para a sombra "sumir" nela. */
  fade?: "chalk" | "paper";
  /** Vai na faixa rolável (borda inferior, margem, espaçamento entre abas). */
  className?: string;
  children: ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const wrap = wrapRef.current;
    if (!scroller || !wrap) return;

    const update = () => {
      const edges = overflowEdges(scroller);
      wrap.dataset.fadeStart = String(edges.start);
      wrap.dataset.fadeEnd = String(edges.end);
    };
    update();

    scroller.addEventListener("scroll", update, { passive: true });
    // A largura útil muda ao girar o aparelho e quando a fonte do site
    // termina de carregar (as abas ficam mais largas) — observar só o
    // contêiner não pega o segundo caso, por isso cada aba também é observada.
    const observer = new ResizeObserver(update);
    observer.observe(scroller);
    for (const child of Array.from(scroller.children)) observer.observe(child);

    return () => {
      scroller.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const active = scroller.querySelector<HTMLElement>(
      '[aria-current="page"], [aria-selected="true"]',
    );
    if (!active) return;
    // Mexe só em scrollLeft da faixa: scrollIntoView também rolaria a página
    // na vertical, e abrir uma aba não deve fazer a tela pular.
    scroller.scrollLeft = scrollLeftToCenter({
      containerWidth: scroller.clientWidth,
      scrollWidth: scroller.scrollWidth,
      itemLeft: active.offsetLeft,
      itemWidth: active.offsetWidth,
    });
  }, [activeKey]);

  return (
    <div
      ref={wrapRef}
      data-fade-start="false"
      data-fade-end="false"
      className={cn(
        "relative print:hidden",
        "before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:z-10 before:w-8 before:bg-linear-to-r before:to-transparent before:opacity-0 before:transition-opacity",
        "after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:z-10 after:w-8 after:bg-linear-to-l after:to-transparent after:opacity-0 after:transition-opacity",
        "data-[fade-start=true]:before:opacity-100 data-[fade-end=true]:after:opacity-100",
        fade === "paper" ? "before:from-paper after:from-paper" : "before:from-chalk after:from-chalk",
      )}
    >
      <div
        ref={scrollerRef}
        role={role}
        aria-label={label}
        className={cn("relative flex overflow-x-auto overscroll-x-contain", className)}
      >
        {children}
      </div>
    </div>
  );
}
