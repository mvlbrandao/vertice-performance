"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        background:
          "radial-gradient(circle at 20% 20%, rgba(255,214,0,.10), transparent 45%), linear-gradient(160deg, #111111 0%, #000000 100%)",
      }}
    >
      <div className="w-full max-w-[920px] bg-paper rounded-lg overflow-hidden grid md:grid-cols-[1.1fr_1fr] shadow-[0_40px_80px_-30px_rgba(0,0,0,.7)]">
        <div
          className="text-chalk p-9 relative flex flex-col justify-between min-h-[220px] md:min-h-[480px]"
          style={{
            background:
              "repeating-linear-gradient(90deg, rgba(255,220,0,.22) 0 2px, transparent 2px 64px), linear-gradient(180deg, #1A1A1A 0%, #000000 100%)",
          }}
        >
          <div className="flex items-center gap-2.5 z-10">
            <div className="w-3 h-3 rounded-full bg-amber" />
            <span className="font-display text-[22px] tracking-wide">HR PERFORMANCE</span>
          </div>
          <div className="z-10">
            <h1 className="text-[52px] leading-[0.95] mb-2.5">
              Alta
              <br />
              performance
              <br />
              começa aqui.
            </h1>
            <p className="text-sm text-white/75 max-w-[320px]">
              Plataforma de acompanhamento técnico, físico e mental para
              atletas de base — do treino à mesa tática.
            </p>
          </div>
          <div className="flex gap-5 z-10">
            <div>
              <b className="block font-display text-[26px] text-amber">128</b>
              <span className="text-[11.5px] text-white/55 uppercase tracking-wide">
                Atletas ativos
              </span>
            </div>
            <div>
              <b className="block font-display text-[26px] text-amber">14</b>
              <span className="text-[11.5px] text-white/55 uppercase tracking-wide">
                Categorias
              </span>
            </div>
            <div>
              <b className="block font-display text-[26px] text-amber">96%</b>
              <span className="text-[11.5px] text-white/55 uppercase tracking-wide">
                Check-in semanal
              </span>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-9 flex flex-col gap-4.5 gap-[18px]">
          <div>
            <h2 className="text-[30px] mb-0.5">Entrar</h2>
            <p className="text-[13.5px] text-ink-soft">
              Acesse com o e-mail e senha cadastrados pelo seu clube.
            </p>
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
            <Input
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error && (
            <div className="text-clay text-[12.5px] font-medium">{error}</div>
          )}
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
