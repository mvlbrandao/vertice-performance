"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { signup } from "@/lib/actions/signup";

export function SignupForm({
  trialDays,
  maxAthletes,
  vindoDaDemo,
}: {
  trialDays: number;
  maxAthletes: number;
  vindoDaDemo?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pronto, setPronto] = useState<{ slug: string } | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    const result = await signup(formData);
    if (result.error || !result.slug) {
      setPending(false);
      setError(result.error ?? "Não foi possível criar sua conta.");
      return;
    }

    // Entra já logado: mandar pro login logo depois de criar a conta faz a
    // pessoa digitar a mesma senha duas vezes em dez segundos, e é onde se
    // perde quem acabou de decidir experimentar.
    const supabase = createClient();
    // Encerra a sessão da demonstração antes de entrar na nova: sem isso o
    // navegador guardaria duas sessões e a pessoa poderia voltar ao clube
    // de demonstração sem entender por quê.
    if (vindoDaDemo) await supabase.auth.signOut();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setPending(false);

    if (signInError) {
      setPronto({ slug: result.slug });
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  if (pronto) {
    return (
      <Moldura>
        <h2 className="text-[26px] mb-1 font-display">Conta criada! ✅</h2>
        <p className="text-[13.5px] text-ink-soft mb-4">
          Seu clube está pronto. Entre com o e-mail e a senha que você acabou de cadastrar.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-sm bg-pitch-dark text-chalk font-semibold px-4 py-2.5 text-[13px]"
        >
          Ir para o login
        </Link>
      </Moldura>
    );
  }

  return (
    <Moldura>
      <div className="mb-4">
        <h2 className="text-[30px] mb-0.5 font-display">Criar meu clube</h2>
        <p className="text-[13.5px] text-ink-soft m-0">
          {trialDays} dias grátis, até {maxAthletes} atletas. Sem cartão agora.
        </p>
        {vindoDaDemo && (
          <p className="text-[12.5px] text-ink-faint mt-1.5 mb-0">
            Você sai da demonstração e entra no seu próprio clube, vazio e pronto para uso.
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-[18px]">
        <Field label="Nome do clube">
          <Input name="clubName" required placeholder="Ex: Vértice Futsal" autoComplete="organization" />
        </Field>
        <Field label="Seu nome">
          <Input name="fullName" required placeholder="Como você quer ser chamado" autoComplete="name" />
        </Field>
        <Field label="Seu e-mail">
          <Input name="email" type="email" required autoComplete="email" placeholder="voce@email.com" />
        </Field>
        <Field label="Crie uma senha">
          <Input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
          />
        </Field>

        {error && <p className="text-clay text-[13px] font-medium m-0">{error}</p>}

        <Button variant="solid" size="md" type="submit" disabled={pending}>
          {pending ? "Criando seu clube…" : "Começar teste grátis"}
        </Button>

        <p className="text-[12.5px] text-ink-faint text-center m-0">
          Já tem conta?{" "}
          <Link href="/login" className="font-semibold text-ink underline">
            Entrar
          </Link>
        </p>
      </form>
    </Moldura>
  );
}

function Moldura({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-5 sm:p-6"
      style={{
        background:
          "radial-gradient(circle at 20% 20%, rgba(255,214,0,.10), transparent 45%), linear-gradient(160deg, #111111 0%, #000000 100%)",
      }}
    >
      <div className="w-full max-w-[440px] bg-paper rounded-xl p-8 sm:p-10 shadow-[0_50px_100px_-30px_rgba(0,0,0,.75)] border border-white/5">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-3 h-3 rounded-full bg-amber shadow-[0_0_16px_rgba(255,214,0,.7)]" />
          <span className="font-display text-[19px] tracking-wide">VÉRTICE PERFORMANCE</span>
        </div>
        {children}
      </div>
    </div>
  );
}
