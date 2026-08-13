"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { updatePlatformSettings } from "@/lib/actions/platformAdmin";
import type { PlatformSettings } from "@/lib/platform/license";

export function PlatformSettingsForm({ settings }: { settings: PlatformSettings }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    const result = await updatePlatformSettings(new FormData(e.currentTarget));
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <Card>
      <h2 className="text-[17px] mt-0 mb-1">Plano padrão</h2>
      <p className="text-[13px] text-ink-soft mt-0 mb-3.5">
        Vale para todos os clubes. Um clube pode ter cota ou preço próprios, definidos na linha
        dele abaixo.
      </p>
      <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <Field label="Nome do plano">
          <Input name="planName" defaultValue={settings.planName} required />
        </Field>
        <Field label="Mensalidade (R$)">
          <Input
            name="priceReais"
            defaultValue={(settings.priceCents / 100).toFixed(2).replace(".", ",")}
            inputMode="decimal"
            required
          />
        </Field>
        <Field label="Dias de teste">
          <Input name="trialDays" type="number" min={0} max={365} defaultValue={settings.trialDays} required />
        </Field>
        <Field label="Atletas por licença">
          <Input
            name="maxAthletes"
            type="number"
            min={1}
            defaultValue={settings.maxAthletes}
            required
          />
        </Field>
        <Field label="Retenção após cancelar (dias)">
          <Input
            name="retentionDays"
            type="number"
            min={1}
            max={3650}
            defaultValue={settings.retentionDays}
            required
          />
        </Field>
        <div className="lg:col-span-5 flex items-center gap-2">
          <Button variant="solid" size="sm" type="submit" disabled={pending}>
            {pending ? "Salvando…" : "Salvar plano"}
          </Button>
          {saved && <span className="text-[12.5px] text-grass font-semibold">✓ salvo</span>}
          {error && <span className="text-[12.5px] text-clay font-medium">{error}</span>}
        </div>
      </form>
    </Card>
  );
}
