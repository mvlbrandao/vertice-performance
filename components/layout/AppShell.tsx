"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { initials } from "@/lib/utils/initials";
import { LogoutButton } from "@/components/layout/LogoutButton";
import { NotificationPrompt } from "@/components/push/NotificationPrompt";

export interface NavItem {
  href: string;
  icon: string;
  label: string;
  children?: NavItem[];
}

export function AppShell({
  navItems,
  userName,
  roleLabel,
  children,
}: {
  navItems: NavItem[];
  userName: string;
  roleLabel: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const item of navItems) {
      if (item.children?.some((c) => isActive(c.href))) initial[item.label] = true;
    }
    return initial;
  });

  return (
    <div className="flex min-h-screen">
      <aside
        className={cn(
          "w-[238px] bg-pitch-dark text-chalk shrink-0 flex flex-col p-3.5 gap-1 sticky top-0 h-screen border-r-2 border-amber z-40",
          "max-[840px]:fixed max-[840px]:h-full max-[840px]:transition-[left] max-[840px]:duration-200",
          open ? "max-[840px]:left-0 max-[840px]:shadow-2xl" : "max-[840px]:-left-[260px]",
        )}
      >
        <div className="flex items-center gap-2.5 px-2.5 pt-1.5 pb-4 shrink-0">
          <div className="w-3 h-3 rounded-full bg-amber" />
          <span className="font-display text-[22px] tracking-wide">
            VÉRTICE PERFORMANCE
          </span>
        </div>
        <nav className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1 pr-1">
          {navItems.map((item) => {
            if (item.children) {
              const groupActive = item.children.some((c) => isActive(c.href));
              const isOpen = expanded[item.label] ?? groupActive;
              return (
                <div key={item.label}>
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((prev) => ({ ...prev, [item.label]: !isOpen }))
                    }
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-sm text-[13.5px] font-semibold",
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
                        const active = isActive(child.href);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={() => setOpen(false)}
                            className={cn(
                              "flex items-center gap-2.5 px-3 py-2 rounded-sm text-[13px] font-semibold",
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

            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 rounded-sm text-[13.5px] font-semibold",
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

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="sticky top-0 z-30 bg-chalk/95 backdrop-blur-sm border-b border-line px-5 py-3.5 flex items-center gap-3 min-[841px]:hidden">
          <button
            onClick={() => setOpen((v) => !v)}
            className="bg-transparent border-none text-xl text-ink"
            aria-label="Abrir menu"
          >
            ☰
          </button>
          <span className="font-display text-lg tracking-wide">VÉRTICE PERFORMANCE</span>
        </div>
        <main className="flex-1 px-7 pt-6 pb-16 max-[840px]:px-4 max-[840px]:pt-4.5">
          <NotificationPrompt />
          {children}
        </main>
      </div>
    </div>
  );
}
