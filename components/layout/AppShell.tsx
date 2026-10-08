"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { initials } from "@/lib/utils/initials";
import { isNavActive } from "@/lib/utils/navigation";
import { lockBodyScroll } from "@/lib/utils/scrollLock";
import { LogoutButton } from "@/components/layout/LogoutButton";
import { NotificationPrompt } from "@/components/push/NotificationPrompt";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";

export interface NavItem {
  href: string;
  icon: string;
  label: string;
  /**
   * Só acende com o caminho idêntico. Necessário quando o href de um item é
   * prefixo dos irmãos (ex.: /admin e /admin/clubes) — sem isso o item raiz
   * ficaria marcado em todas as páginas.
   */
  exact?: boolean;
  children?: NavItem[];
}

const DRAWER_ID = "menu-lateral";

export function AppShell({
  navItems,
  mobileTabs,
  userName,
  roleLabel,
  children,
}: {
  navItems: NavItem[];
  /**
   * Atalhos da barra inferior (só abaixo de 841px), para o uso de uma mão no
   * celular. O último botão, "Mais", abre o menu lateral completo. Opcional:
   * sem ela o shell fica como era (coach, staff e admin não usam).
   */
  mobileTabs?: NavItem[];
  userName: string;
  roleLabel: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  // O menu "pertence" à página em que foi aberto: navegar muda o pathname e
  // ele fecha sozinho, sem efeito que dispare setState (e sem ficar aberto
  // por cima da página nova quando o toque vem de um link fora do menu).
  const [openFor, setOpenFor] = useState<string | null>(null);
  // Esquecer a página de origem ao sair dela. Só comparar não basta: o botão
  // Voltar (ou um toque na aba da barra inferior) devolve o pathname antigo e
  // o menu reabriria sozinho, com a rolagem travada e o fundo inerte.
  if (openFor !== null && openFor !== pathname) setOpenFor(null);
  const open = openFor === pathname;
  const toggleRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const hasTabs = !!mobileTabs?.length;

  function setOpen(next: boolean) {
    setOpenFor(next ? pathname : null);
  }

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const item of navItems) {
      if (item.children?.some((c) => isNavActive(pathname, c.href))) initial[item.label] = true;
    }
    return initial;
  });

  useEffect(() => {
    if (!open) return;

    const unlock = lockBodyScroll();
    const toggle = toggleRef.current;
    // Leva o foco para dentro do menu (teclado e leitor de tela) e devolve ao
    // botão que o abriu quando fecha. No quadro seguinte, não já: a gaveta
    // acaba de sair de visibility:hidden e, no primeiro quadro da transição,
    // o navegador ainda a considera oculta — focus() ali seria ignorado.
    const frame = requestAnimationFrame(() => closeRef.current?.focus());

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenFor(null);
    }
    // Girar o aparelho ou alargar a janela até o desktop deixa o menu fixo
    // à vista; sem fechar aqui, a trava de rolagem ficaria ligada à toa.
    const desktop = window.matchMedia("(min-width: 841px)");
    function onBreakpoint() {
      if (desktop.matches) setOpenFor(null);
    }
    document.addEventListener("keydown", onKey);
    desktop.addEventListener("change", onBreakpoint);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      desktop.removeEventListener("change", onBreakpoint);
      unlock();
      toggle?.focus();
    };
  }, [open]);

  return (
    <div className="flex min-h-dvh">
      <aside
        id={DRAWER_ID}
        aria-label="Menu principal"
        className={cn(
          "w-[238px] bg-pitch-dark text-chalk shrink-0 flex flex-col p-3.5 gap-1 sticky top-0 h-dvh border-r-2 border-amber z-40",
          // No celular vira gaveta. `invisible` quando fechada tira os links
          // da ordem de tabulação e da leitura de tela (só deslizar para fora
          // da tela deixaria tudo focável); a transição de visibility segura o
          // "visível" até o fim da animação de saída.
          "max-[840px]:fixed max-[840px]:top-0 max-[840px]:left-0 max-[840px]:z-50 max-[840px]:w-[min(280px,86vw)]",
          "max-[840px]:pt-[max(0.875rem,env(safe-area-inset-top))] max-[840px]:pb-[max(0.875rem,env(safe-area-inset-bottom))] max-[840px]:pl-[max(0.875rem,env(safe-area-inset-left))]",
          "max-[840px]:transition-[transform,visibility] max-[840px]:duration-200 motion-reduce:transition-none",
          open
            ? "max-[840px]:translate-x-0 max-[840px]:shadow-2xl"
            : "max-[840px]:-translate-x-full max-[840px]:invisible",
        )}
      >
        <div className="flex items-center gap-2.5 px-2.5 pt-1.5 pb-4 shrink-0">
          <div className="w-3 h-3 rounded-full bg-amber" />
          {/* No celular o botão de fechar divide a linha com o nome; 22px não
              cabe nos 280px da gaveta e o nome quebrava em duas linhas. */}
          <span className="font-display text-[22px] max-[840px]:text-[19px] whitespace-nowrap tracking-wide">
            VÉRTICE PERFORMANCE
          </span>
          <button
            ref={closeRef}
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
            className="ml-auto -mr-2 -mt-1.5 -mb-1.5 size-11 shrink-0 inline-flex items-center justify-center rounded-sm text-lg text-white/65 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber min-[841px]:hidden"
          >
            ✕
          </button>
        </div>
        <nav
          aria-label="Seções"
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col gap-1 pr-1"
        >
          {navItems.map((item) => {
            if (item.children) {
              const groupActive = item.children.some((c) => isNavActive(pathname, c.href));
              const isOpen = expanded[item.label] ?? groupActive;
              return (
                <div key={item.label}>
                  <button
                    type="button"
                    onClick={() => setExpanded((prev) => ({ ...prev, [item.label]: !isOpen }))}
                    aria-expanded={isOpen}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2.5 pointer-coarse:py-3 rounded-sm text-[13.5px] font-semibold",
                      groupActive && !isOpen
                        ? "bg-amber/15 text-white"
                        : "text-white/65 hover:bg-amber/10 hover:text-white",
                    )}
                  >
                    <span className="w-[18px] text-center text-[15px]">{item.icon}</span>
                    <span className="flex-1 text-left">{item.label}</span>
                    <span className={cn("text-[10px] transition-transform", isOpen && "rotate-90")}>
                      ▸
                    </span>
                  </button>
                  {isOpen && (
                    <div className="flex flex-col gap-1 mt-1 ml-[18px] pl-2.5 border-l border-amber/15">
                      {item.children.map((child) => {
                        // Exato, não por prefixo: itens-filho são páginas
                        // completas, e um filho cujo link é prefixo de
                        // outro (caso de Dispersão = /comissao-tecnica,
                        // prefixo de /comissao-tecnica/planejamento) não
                        // pode acender junto com o irmão mais específico.
                        const active = pathname === child.href;
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={() => setOpen(false)}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              "flex items-center gap-2.5 px-3 py-2 pointer-coarse:py-2.5 rounded-sm text-[13px] font-semibold",
                              active
                                ? "bg-amber text-pitch-dark font-bold"
                                : "text-white/65 hover:bg-amber/10 hover:text-white",
                            )}
                          >
                            <span className="w-[15px] text-center text-[13px]">{child.icon}</span>
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const active = isNavActive(pathname, item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 pointer-coarse:py-3 rounded-sm text-[13.5px] font-semibold",
                  active
                    ? "bg-amber text-pitch-dark font-bold"
                    : "text-white/65 hover:bg-amber/10 hover:text-white",
                )}
              >
                <span className="w-[18px] text-center text-[15px]">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto pt-3 border-t border-amber/15 flex items-center gap-2.5 shrink-0">
          <div className="w-[34px] h-[34px] rounded-full bg-amber text-pitch-dark flex items-center justify-center font-extrabold text-[13px] shrink-0">
            {initials(userName)}
          </div>
          <div className="min-w-0">
            <b className="block text-xs truncate">{userName}</b>
            <span className="text-[11px] text-[#666]">{roleLabel}</span>
          </div>
          <LogoutButton />
        </div>
      </aside>

      {/* Fundo escurecido: dá a "porta" para fechar tocando fora do menu. Fica
          acima do conteúdo e do botão de ajuda (z-40) e abaixo da gaveta. */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-[45] bg-black/55 transition-opacity duration-200 motion-reduce:transition-none min-[841px]:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-chalk/95 backdrop-blur-sm border-b border-line pt-[env(safe-area-inset-top)] pl-[max(0.5rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] min-[841px]:hidden">
          <div className="flex items-center gap-1 h-14">
            <button
              ref={toggleRef}
              type="button"
              onClick={() => setOpen(!open)}
              aria-label={open ? "Fechar menu" : "Abrir menu"}
              aria-expanded={open}
              aria-controls={DRAWER_ID}
              className="size-11 shrink-0 inline-flex items-center justify-center rounded-sm bg-transparent border-none text-xl text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber"
            >
              ☰
            </button>
            <span className="font-display text-lg tracking-wide">VÉRTICE PERFORMANCE</span>
          </div>
        </header>
        {/* inert: com o menu aberto o foco não pode escapar para a página de
            trás (o fundo escurecido só bloqueia o toque, não o Tab). */}
        <main
          inert={open}
          className={cn(
            "flex-1 px-7 pt-6 pb-16 max-[840px]:pt-4.5",
            "max-[840px]:pl-[max(1rem,env(safe-area-inset-left))] max-[840px]:pr-[max(1rem,env(safe-area-inset-right))]",
            // A barra inferior é fixa: sem esta reserva ela taparia o fim da
            // página (o último cartão, o botão de salvar).
            hasTabs && "max-[840px]:pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom)+1.5rem)]",
          )}
        >
          <InstallPrompt />
          <NotificationPrompt />
          {children}
        </main>
      </div>

      {hasTabs && (
        <nav
          aria-label="Atalhos"
          inert={open}
          className="fixed inset-x-0 bottom-0 z-30 bg-pitch-dark text-white border-t-2 border-amber pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] min-[841px]:hidden print:hidden"
        >
          <ul
            className="m-0 p-0 list-none grid"
            style={{ gridTemplateColumns: `repeat(${mobileTabs.length + 1}, minmax(0, 1fr))` }}
          >
            {mobileTabs.map((tab) => {
              const active = isNavActive(pathname, tab.href, tab.exact);
              return (
                <li key={tab.href} className="contents">
                  <Link
                    href={tab.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-[var(--tabbar-h)] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold border-t-[3px] -mt-0.5 transition-colors",
                      active
                        ? "border-amber text-amber"
                        : "border-transparent text-white/65 active:text-white",
                    )}
                  >
                    <span className="text-[19px] leading-none" aria-hidden="true">
                      {tab.icon}
                    </span>
                    <span className="max-w-full truncate px-1">{tab.label}</span>
                  </Link>
                </li>
              );
            })}
            <li className="contents">
              <button
                type="button"
                onClick={() => setOpen(true)}
                aria-expanded={open}
                aria-controls={DRAWER_ID}
                className={cn(
                  "flex h-[var(--tabbar-h)] flex-col items-center justify-center gap-0.5 text-[11px] font-semibold border-t-[3px] -mt-0.5 transition-colors",
                  open ? "border-amber text-amber" : "border-transparent text-white/65 active:text-white",
                )}
              >
                <span className="text-[19px] leading-none" aria-hidden="true">
                  ☰
                </span>
                <span>Mais</span>
              </button>
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
}
