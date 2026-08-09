"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { testAsaasConnection } from "@/lib/actions/asaasBilling";

export function AsaasConnectionCard({ isSandbox }: { isSandbox: boolean }) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<
    { ok: true; name: string; email: string } | { ok: false; error: string } | null
  >(null);

  async function handleTest() {
    setPending(true);
    const res = await testAsaasConnection();
    setResult(res.success ? { ok: true, name: res.name, email: res.email } : { ok: false, error: res.error });
    setPending(false);
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Badge tone={isSandbox ? "amber" : "green"}>{isSandbox ? "Sandbox" : "Produção"}</Badge>
        <span className="text-xs text-ink-faint">Ambiente configurado no servidor</span>
      </div>
      <Button variant="outline" size="sm" onClick={handleTest} disabled={pending}>
        {pending ? "Testando…" : "Testar conexão"}
      </Button>
      {result && (
        <div
          className={`mt-3 text-[12.5px] rounded-md px-3 py-2.5 ${
            result.ok
              ? "bg-[#E8F5E9] border border-[#A5D6A7] text-[#1B5E20]"
              : "bg-[#FDE8E8] border border-[#F5AAAA] text-[#8B0000]"
          }`}
        >
          {result.ok
            ? `✅ Conectado como ${result.name} (${result.email})`
            : `❌ ${result.error}`}
        </div>
      )}
    </div>
  );
}
