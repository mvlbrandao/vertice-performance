"use client";

import { useEffect } from "react";

/**
 * Registra o service worker no carregamento. Antes ele só era registrado
 * quando a pessoa ativava notificações — ou seja, quem recusasse o push
 * ficava também sem o cache offline, que não tem relação nenhuma com isso.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Falha aqui não pode derrubar a página: sem service worker o app
      // segue funcionando normalmente, só perde offline e push.
    });
  }, []);

  return null;
}
