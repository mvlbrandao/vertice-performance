"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { subscribeToPush } from "@/lib/actions/push";
import {
  isPushSupported,
  getExistingSubscription,
  subscribeToPushBrowser,
  PushConfigError,
} from "@/lib/push/subscribeClient";

const DISMISS_KEY = "vertice-push-prompt-dismissed";

export function NotificationPrompt() {
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function evaluate() {
      if (!isPushSupported()) return;
      if (localStorage.getItem(DISMISS_KEY)) return;
      if (Notification.permission === "denied") return;

      const shouldShow =
        Notification.permission !== "granted" || !(await getExistingSubscription());
      if (!cancelled && shouldShow) setVisible(true);
    }

    evaluate();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleEnable() {
    setPending(true);
    setError(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("Notificações não foram permitidas. Você pode ativar depois nas configurações do navegador.");
        setPending(false);
        return;
      }
      const subscription = await subscribeToPushBrowser();
      const result = await subscribeToPush(subscription);
      if (result.error) {
        setError(result.error);
        setPending(false);
        return;
      }
      setVisible(false);
    } catch (e) {
      // Mostra o motivo real em vez de engolir tudo numa mensagem genérica —
      // sem isso, uma chave VAPID faltando no servidor e um navegador sem
      // suporte viravam exatamente o mesmo erro, impossível de diagnosticar.
      if (e instanceof PushConfigError) {
        setError(e.message);
      } else {
        const detail = e instanceof Error ? e.message : String(e);
        setError(`Não foi possível ativar as notificações: ${detail}`);
      }
    }
    setPending(false);
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="flex items-center gap-3.5 bg-pitch-dark text-chalk rounded-md px-4 py-3.5 mb-4 flex-wrap print:hidden">
      <span className="text-2xl shrink-0">🔔</span>
      <div className="flex-1 min-w-[220px]">
        <b className="block text-sm">Ative as notificações</b>
        <span className="text-xs text-white/65">
          Saiba na hora quando sair uma convocação, seu score mudar ou um desafio for avaliado.
        </span>
        {error && <span className="block text-xs text-[#FFB4A8] mt-1">{error}</span>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="ghost" size="sm" onClick={handleDismiss} className="text-white/60 hover:text-white">
          Agora não
        </Button>
        <Button variant="amber" size="sm" onClick={handleEnable} disabled={pending}>
          {pending ? "Ativando…" : "Ativar"}
        </Button>
      </div>
    </div>
  );
}
