"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";

export interface MfaFactorView {
  id: string;
  friendlyName: string | null;
  type: string;
  status: "verified" | "unverified";
  createdAt: string;
}

interface Enrollment {
  factorId: string;
  /** Data URL do QR (o SDK já devolve com o prefixo data:image/svg+xml). */
  qr: string;
  secret: string;
}

/**
 * Traduz o erro do Auth. A biblioteca devolve texto em inglês e, para código
 * errado, um 400 genérico; a pessoa precisa saber se o problema é o código
 * ou a configuração do projeto.
 */
function describeError(error: { message?: string; code?: string }): string {
  const message = error.message ?? "";
  if (error.code === "mfa_verification_failed" || /invalid totp|verification failed/i.test(message)) {
    return "Código incorreto ou vencido. Confira o relógio do celular e digite o código atual.";
  }
  if (error.code === "insufficient_aal" || /aal2/i.test(message)) {
    return "Confirme primeiro o código do aplicativo para remover um segundo fator já ativo.";
  }
  if (/not enabled|disabled/i.test(message)) {
    return "O segundo fator por aplicativo (TOTP) não está habilitado neste projeto do Supabase.";
  }
  return message || "Não foi possível concluir. Tente de novo.";
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

export function MfaManager({
  factors,
  currentLevel,
  requireMfa,
}: {
  factors: MfaFactorView[];
  currentLevel: string | null;
  requireMfa: boolean;
}) {
  const router = useRouter();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totpVerified = factors.filter((f) => f.type === "totp" && f.status === "verified");
  const hasFactor = totpVerified.length > 0;
  const isAal2 = currentLevel === "aal2";
  // Tem fator, mas esta sessão ainda não o usou: falta digitar o código.
  const needsChallenge = hasFactor && !isAal2;

  function reset() {
    setCode("");
    setError(null);
  }

  async function startEnroll() {
    setBusy(true);
    reset();
    const supabase = createClient();

    // Tentativa abandonada deixa um fator "não verificado" para trás, e o
    // próximo cadastro esbarraria nele. Remover um não verificado não exige
    // segundo fator.
    for (const f of factors.filter((x) => x.status === "unverified")) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }

    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Autenticador ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
      issuer: "Vértice Performance",
    });
    setBusy(false);
    if (enrollError || !data) {
      setError(describeError(enrollError ?? {}));
      return;
    }
    setEnrollment({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    setShowSecret(false);
  }

  async function cancelEnroll() {
    if (!enrollment) return;
    setBusy(true);
    await createClient().auth.mfa.unenroll({ factorId: enrollment.factorId });
    setBusy(false);
    setEnrollment(null);
    reset();
    router.refresh();
  }

  async function verify(event: FormEvent<HTMLFormElement>, factorId: string) {
    event.preventDefault();
    if (code.length !== 6) {
      setError("Digite os 6 números do aplicativo.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: verifyError } = await createClient().auth.mfa.challengeAndVerify({
      factorId,
      code,
    });
    setBusy(false);
    if (verifyError) {
      setError(describeError(verifyError));
      return;
    }
    // O Auth emitiu uma sessão nova (nível 2) e o cliente já a gravou nos
    // cookies; o refresh faz o servidor passar a enxergá-la.
    setEnrollment(null);
    reset();
    router.refresh();
  }

  async function remove(factorId: string) {
    setBusy(true);
    setError(null);
    const { error: removeError } = await createClient().auth.mfa.unenroll({ factorId });
    setBusy(false);
    setConfirmRemove(null);
    if (removeError) {
      setError(describeError(removeError));
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <div className="flex items-center gap-2 flex-wrap mb-1">
        <h2 className="text-[17px] m-0">Segundo fator (aplicativo autenticador)</h2>
        {isAal2 ? (
          <Badge tone="green">sessão protegida</Badge>
        ) : hasFactor ? (
          <Badge tone="amber">falta confirmar</Badge>
        ) : (
          <Badge tone="dark">não cadastrado</Badge>
        )}
      </div>
      <p className="text-[13px] text-ink-soft mt-0 mb-3.5">
        Um código de 6 números gerado por aplicativo (Google Authenticator, 1Password, Authy…) além
        da senha. Se alguém descobrir sua senha, ainda não entra.
      </p>

      {requireMfa && !isAal2 && (
        <p className="text-[13px] font-medium text-clay bg-[#FDE8E8] rounded-sm px-3 py-2 mt-0 mb-3.5">
          O segundo fator é obrigatório neste ambiente. As demais telas da administração ficam
          bloqueadas até você {hasFactor ? "confirmar o código abaixo" : "cadastrar um aplicativo"}.
        </p>
      )}

      {error && (
        <p role="alert" className="text-clay text-[12.5px] font-medium mt-0 mb-3">
          {error}
        </p>
      )}

      {/* Fatores já cadastrados */}
      {factors.length > 0 && (
        <ul className="list-none m-0 mb-4 p-0 flex flex-col gap-2">
          {factors.map((f) => (
            <li
              key={f.id}
              className="flex flex-wrap items-center gap-2 border border-line rounded-sm px-3 py-2"
            >
              <div className="flex-1 min-w-0">
                <b className="text-[13px] block break-words">{f.friendlyName ?? "Autenticador"}</b>
                <span className="text-[11px] text-ink-faint">
                  {f.status === "verified" ? "ativo" : "não concluído"} · criado em{" "}
                  {new Date(f.createdAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                </span>
              </div>
              {confirmRemove === f.id ? (
                <div className="flex items-center gap-2">
                  <Button variant="danger" size="sm" disabled={busy} onClick={() => remove(f.id)}>
                    Confirmar remoção
                  </Button>
                  <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirmRemove(null)}>
                    Voltar
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy || (f.status === "verified" && !isAal2)}
                  title={
                    f.status === "verified" && !isAal2
                      ? "Confirme o código do aplicativo antes de remover"
                      : undefined
                  }
                  onClick={() => setConfirmRemove(f.id)}
                >
                  Remover
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Sessão com fator, ainda sem o código: confirmar */}
      {needsChallenge && !enrollment && (
        <form onSubmit={(e) => verify(e, totpVerified[0].id)} className="flex items-end gap-2 flex-wrap">
          <Field label="Código do aplicativo">
            <Input
              value={code}
              onChange={(e) => setCode(onlyDigits(e.target.value))}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="000000"
              className="w-36 font-mono tracking-widest"
              required
            />
          </Field>
          <Button variant="solid" size="sm" type="submit" disabled={busy || code.length !== 6}>
            {busy ? "Confirmando…" : "Confirmar"}
          </Button>
        </form>
      )}

      {/* Cadastro em andamento: QR + primeiro código */}
      {enrollment && (
        <div className="border border-line rounded-sm p-3.5 flex flex-col gap-3">
          <p className="text-[13px] mt-0 mb-0">
            <b>1.</b> No aplicativo, adicione uma conta lendo o QR code.{" "}
            <b>2.</b> Digite o código de 6 números que ele mostrar.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL gerada pelo Auth; next/image não otimiza isso */}
            <img
              src={enrollment.qr}
              alt="QR code para cadastrar o aplicativo autenticador"
              width={176}
              height={176}
              className="bg-white border border-line rounded-sm p-1.5 w-44 h-44 shrink-0"
            />
            <div className="flex flex-col gap-3 min-w-0 w-full">
              <Field label="Sem câmera? Digite esta chave no aplicativo">
                <div className="flex items-center gap-2">
                  <Input
                    type={showSecret ? "text" : "password"}
                    value={enrollment.secret}
                    readOnly
                    autoComplete="off"
                    className="font-mono text-xs flex-1 min-w-0"
                  />
                  <Button variant="outline" size="sm" type="button" onClick={() => setShowSecret((v) => !v)}>
                    {showSecret ? "Ocultar" : "Mostrar"}
                  </Button>
                </div>
              </Field>
              <form
                onSubmit={(e) => verify(e, enrollment.factorId)}
                className="flex items-end gap-2 flex-wrap"
              >
                <Field label="Código do aplicativo">
                  <Input
                    value={code}
                    onChange={(e) => setCode(onlyDigits(e.target.value))}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    placeholder="000000"
                    className="w-36 font-mono tracking-widest"
                    required
                  />
                </Field>
                <Button variant="solid" size="sm" type="submit" disabled={busy || code.length !== 6}>
                  {busy ? "Verificando…" : "Ativar"}
                </Button>
                <Button variant="ghost" size="sm" type="button" disabled={busy} onClick={cancelEnroll}>
                  Cancelar
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}

      {!enrollment && !needsChallenge && (
        <Button variant={hasFactor ? "outline" : "solid"} size="sm" disabled={busy} onClick={startEnroll}>
          {busy ? "Preparando…" : hasFactor ? "Cadastrar outro aplicativo" : "Cadastrar aplicativo"}
        </Button>
      )}
    </Card>
  );
}
