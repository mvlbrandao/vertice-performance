"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

const FEATURES = [
  { icon: "📊", label: "Card de score estilo FIFA" },
  { icon: "🧭", label: "Análise SWOT por atleta" },
  { icon: "💰", label: "Financeiro e cobrança integrados" },
];

export function LoginForm({
  clubName,
  isDemo,
  aviso,
}: {
  clubName?: string | null;
  isDemo?: boolean;
  aviso?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (signInError) {
      setError("E-mail ou senha inválidos.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-5 sm:p-6"
      style={{
        background:
          "radial-gradient(circle at 20% 20%, rgba(255,214,0,.10), transparent 45%), linear-gradient(160deg, #111111 0%, #000000 100%)",
      }}
    >
      <div className="w-full max-w-[960px] bg-paper rounded-xl overflow-hidden grid md:grid-cols-[1.1fr_1fr] shadow-[0_50px_100px_-30px_rgba(0,0,0,.75)] border border-white/5">
        <div
          className="text-chalk p-8 sm:p-10 relative flex flex-col justify-between gap-8 min-h-[200px] md:min-h-[520px]"
          style={{
            background:
              "repeating-linear-gradient(90deg, rgba(255,220,0,.22) 0 2px, transparent 2px 64px), linear-gradient(180deg, #1A1A1A 0%, #000000 100%)",
          }}
        >
          <div className="flex items-center gap-2.5 z-10">
            <div className="w-3 h-3 rounded-full bg-amber shadow-[0_0_16px_rgba(255,214,0,.7)]" />
            <span className="font-display text-[22px] tracking-wide">VÉRTICE PERFORMANCE</span>
          </div>
          <div className="z-10">
            <h1 className="text-[42px] sm:text-[52px] leading-[0.95] mb-3 font-display">
              Alta
              <br />
              performance
              <br />
              começa aqui.
            </h1>
            <p className="text-sm text-white/75 max-w-[320px]">
              Plataforma de acompanhamento técnico, físico, mental e
              financeiro para atletas de base — do treino à mesa tática.
            </p>
          </div>
          <div className="flex flex-col gap-2.5 z-10">
            {FEATURES.map((f) => (
              <div key={f.label} className="flex items-center gap-2.5 text-[13px] text-white/80">
                <span className="w-7 h-7 rounded-full bg-amber/15 border border-amber/30 flex items-center justify-center text-sm shrink-0">
                  {f.icon}
                </span>
                {f.label}
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 sm:p-10 flex flex-col gap-4.5 gap-[18px] justify-center">
          <div>
            {clubName && (
              <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">
                  Acesso de
                </span>
                <span className="text-[12.5px] font-bold px-2 py-0.5 rounded-sm bg-pitch-dark text-chalk">
                  {clubName}
                </span>
                {isDemo && (
                  <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-sm border border-amber text-amber">
                    demonstração
                  </span>
                )}
              </div>
            )}
            <h2 className="text-[30px] mb-0.5 font-display">Entrar</h2>
            <p className="text-[13.5px] text-ink-soft">
              Acesse com o e-mail e senha cadastrados pelo seu clube.
            </p>
            <p className="text-[12.5px] text-ink-faint mt-1.5 mb-0">
              Ainda não tem clube?{" "}
              <Link href="/cadastro" className="font-semibold text-ink underline">
                Criar grátis
              </Link>
            </p>
            {aviso && (
              <p className="text-[12.5px] text-clay bg-clay/10 border border-clay/25 rounded-sm px-2.5 py-2 mt-2.5 m-0">
                {aviso}
              </p>
            )}
          </div>
          <Field label="E-mail">
            <Input
              type="email"
              required
              autoComplete="email"
              placeholder="voce@hrperformance.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Senha">
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-16"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-ink-faint hover:text-pitch-dark"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </Field>
          {error && <div className="text-clay text-[12.5px] font-medium">{error}</div>}
          <Button type="submit" variant="solid" disabled={loading} className="w-full">
            {loading ? "Entrando…" : "Entrar na plataforma"}
          </Button>
          <div className="flex gap-2 items-start bg-[#FDE8E8] border border-[#F5AAAA] text-[#8B0000] rounded-md px-3.5 py-3 text-[12.5px] mt-1">
            <span>🔒</span>
            <span>
              Dados de atletas menores de idade são criptografados e
              protegidos conforme LGPD.
            </span>
          </div>
        </form>
      </div>
    </div>
  );
}
