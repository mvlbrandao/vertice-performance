"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { redeemInviteLink } from "@/lib/actions/inviteLinks";

export function RedeemInviteForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const result = await redeemInviteLink({
      token,
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    });
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/login"), 1800);
  }

  if (done) {
    return (
      <div className="bg-[#DDEDE2] border border-[#8CC9A3] rounded-md px-4 py-3.5">
        <b className="block text-sm mb-0.5">Conta criada! ✅</b>
        <span className="text-[12.5px] text-ink-soft">
          Levando você pra tela de login…
        </span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <Field label="Seu e-mail">
        <Input name="email" type="email" required placeholder="voce@email.com" />
      </Field>
      <Field label="Crie uma senha">
        <Input name="password" type="password" required minLength={8} placeholder="Mínimo 8 caracteres" />
      </Field>
      {error && <div className="text-clay text-[12.5px] font-medium">{error}</div>}
      <Button type="submit" variant="solid" disabled={pending} className="mt-1">
        {pending ? "Criando conta…" : "Criar minha conta"}
      </Button>
    </form>
  );
}
