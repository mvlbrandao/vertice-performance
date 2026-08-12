"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

const DISMISS_KEY = "vertice-install-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari no iOS usa esta propriedade não-padrão.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Convite pra instalar o app na tela de início. No Android/desktop o
 * navegador avisa quando é possível (beforeinstallprompt) e conseguimos
 * abrir o instalador nativo. No iPhone esse evento não existe: o Safari só
 * instala pelo menu Compartilhar, então lá mostramos a instrução manual —
 * sem isso, o usuário de iPhone simplesmente nunca instalaria.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(DISMISS_KEY)) return;
    if (isStandalone()) return;

    if (isIos()) {
      // Fora do corpo síncrono do efeito: o iPhone não emite evento algum,
      // então a decisão é imediata e viraria render em cascata.
      const id = setTimeout(() => setShowIosHint(true), 0);
      return () => clearTimeout(id);
    }

    function onPrompt(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDeferred(null);
    setShowIosHint(false);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") localStorage.setItem(DISMISS_KEY, "1");
    setDeferred(null);
  }

  if (!deferred && !showIosHint) return null;

  return (
    <div className="flex items-center gap-3.5 bg-amber text-pitch-dark rounded-md px-4 py-3.5 mb-4 flex-wrap print:hidden">
      <span className="text-2xl shrink-0">📲</span>
      <div className="flex-1 min-w-[220px]">
        <b className="block text-sm">Instale o Vértice no seu celular</b>
        <span className="text-xs opacity-80">
          {showIosHint
            ? "Toque em Compartilhar e escolha “Adicionar à Tela de Início”."
            : "Abre como aplicativo, direto do ícone, e recebe as notificações melhor."}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={dismiss}
          className="text-xs font-semibold px-2.5 py-2 opacity-70 hover:opacity-100"
        >
          Agora não
        </button>
        {deferred && (
          <Button variant="solid" size="sm" onClick={install}>
            Instalar
          </Button>
        )}
      </div>
    </div>
  );
}
