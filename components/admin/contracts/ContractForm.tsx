"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { createContract, updateContract } from "@/lib/actions/contracts";
import {
  BILLING_CYCLES,
  CONTRACT_LIMITS,
  CYCLE_LABEL,
  contractCode,
  monthlyEquivalentCents,
} from "@/lib/platform/contractRules";
import { suggestedEndsOn, type ContractFormValues } from "@/lib/platform/contractView";
import type { ContractActionResult } from "@/lib/platform/contractSchema";
import { formatCents, parseReaisToCents } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";

export interface ClubOption {
  id: string;
  name: string;
  /** Número do contrato vigente do clube, se houver (para avisar antes de enviar). */
  activeNumber: number | null;
}

type Props =
  | {
      mode: "create";
      clubs: ClubOption[];
      initialClubId: string | null;
      values: ContractFormValues;
      defaultQuota: number;
    }
  | {
      mode: "edit";
      contractId: string;
      /** Situação atual: vigente avisa que a edição vai para a trilha. */
      status: "rascunho" | "vigente";
      values: ContractFormValues;
      defaultQuota: number;
    };

const CONTROL = "px-3 py-2.5 border border-line rounded-sm bg-white text-sm focus:outline focus:outline-2 focus:outline-amber focus:outline-offset-1 focus:border-amber w-full min-w-0";

/**
 * Campo com rótulo de verdade (<label> envolvendo o controle): o clique no
 * texto foca o campo e o leitor de tela anuncia o nome. O erro vem logo
 * abaixo, ligado ao controle por aria-describedby.
 */
function FormField({
  label,
  name,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  name: string;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5 min-w-0", className)}>
      <label className="flex flex-col gap-1.5 min-w-0">
        <span className="text-xs font-semibold text-ink-soft uppercase tracking-wide">{label}</span>
        {children}
      </label>
      {hint && (
        <span id={`${name}-hint`} className="text-[11.5px] text-ink-faint">
          {hint}
        </span>
      )}
      {error && (
        <span id={`${name}-error`} role="alert" className="text-[12px] text-clay font-medium">
          {error}
        </span>
      )}
    </div>
  );
}

const ariaFor = (name: string, hasHint: boolean, error?: string) => ({
  "aria-invalid": error ? true : undefined,
  "aria-describedby": [hasHint ? `${name}-hint` : null, error ? `${name}-error` : null].filter(Boolean).join(" ") || undefined,
});

export function ContractForm(props: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const { values, defaultQuota } = props;

  // Controlados porque um depende do outro: o fim sugerido sai do início e do
  // ciclo, e o equivalente mensal sai do valor e do ciclo.
  const [cycle, setCycle] = useState(values.billingCycle);
  const [price, setPrice] = useState(values.priceReais);
  const [startsOn, setStartsOn] = useState(values.startsOn);
  const [endsOn, setEndsOn] = useState(values.endsOn);
  const [clubId, setClubId] = useState(props.mode === "create" ? (props.initialClubId ?? "") : "");
  const [initialStatus, setInitialStatus] = useState<"rascunho" | "vigente">("rascunho");

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [warning, setWarning] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirm, setConfirm] = useState<{ currentNumber: number } | null>(null);
  // Contrato criado: com aviso da trilha a tela não navega sozinha (o aviso se perderia).
  const [created, setCreated] = useState<{ id: string } | null>(null);
  // Rascunho que ficou de pé quando a ativação imediata falhou.
  const [orphanDraft, setOrphanDraft] = useState<string | null>(null);

  const selectedClub = props.mode === "create" ? props.clubs.find((club) => club.id === clubId) : undefined;
  const activeOfClub = selectedClub?.activeNumber ?? null;
  const priceCents = parseReaisToCents(price);
  const equivalent = priceCents !== null && cycle !== "mensal" ? monthlyEquivalentCents(priceCents, cycle) : null;
  const suggestion = suggestedEndsOn(startsOn, cycle);

  async function send(replace: boolean) {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    if (replace) data.set("replace", "true");
    if (props.mode === "edit") data.set("contractId", props.contractId);

    setPending(true);
    setError(null);
    setFieldErrors({});
    setWarning(null);
    setSaved(false);
    setConfirm(null);
    setOrphanDraft(null);

    let result: ContractActionResult;
    try {
      result = props.mode === "create" ? await createContract(data) : await updateContract(data);
    } catch {
      setPending(false);
      setError("Não foi possível falar com o servidor. Confira a conexão e tente de novo.");
      return;
    }
    setPending(false);

    if (result.error) {
      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      if (result.needsReplaceConfirmation) setConfirm(result.needsReplaceConfirmation);
      if (result.contractId) setOrphanDraft(result.contractId);
      return;
    }

    if (props.mode === "create") {
      if (result.warning) {
        setWarning(result.warning);
        setCreated({ id: result.contractId! });
        return;
      }
      router.push(`/admin/contratos/${result.contractId}`);
      return;
    }

    setSaved(true);
    if (result.warning) setWarning(result.warning);
    router.refresh();
  }

  const creating = props.mode === "create";
  const err = (name: string) => fieldErrors[name];

  if (created) {
    return (
      <div className="flex flex-col gap-3" role="status">
        <p className="m-0 text-sm font-semibold">Contrato criado.</p>
        {warning && (
          <p role="alert" className="text-[12.5px] font-medium m-0 px-3 py-2 rounded-sm border border-amber bg-[#FFFBE6]">
            {warning}
          </p>
        )}
        <div>
          <Link
            href={`/admin/contratos/${created.id}`}
            className="inline-flex items-center rounded-sm border border-pitch-dark bg-pitch-dark text-white font-semibold px-3.5 py-2.5 text-sm pointer-coarse:min-h-11"
          >
            Abrir o contrato
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        void send(false);
      }}
      noValidate
      className="flex flex-col gap-5"
    >
      {props.mode === "edit" && props.status === "vigente" && (
        <p className="m-0 text-[12.5px] text-ink-soft px-3 py-2 rounded-sm border border-line bg-chalk">
          Contrato vigente: cada alteração fica registrada na trilha de auditoria.
        </p>
      )}

      {creating && (
        <fieldset className="border-0 p-0 m-0 grid gap-3 sm:grid-cols-2">
          <legend className="sr-only">Clube e situação inicial</legend>
          <FormField label="Clube" name="clubId" error={err("clubId")}>
            <select
              name="clubId"
              value={clubId}
              onChange={(event) => setClubId(event.target.value)}
              required
              className={CONTROL}
              {...ariaFor("clubId", false, err("clubId"))}
            >
              <option value="">Escolha o clube…</option>
              {props.clubs.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                  {club.activeNumber !== null ? ` (tem ${contractCode(club.activeNumber)} vigente)` : ""}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            label="Criar como"
            name="status"
            error={err("status")}
            hint={
              initialStatus === "vigente"
                ? activeOfClub !== null
                  ? `Este clube já tem o ${contractCode(activeOfClub)} vigente: será pedida a confirmação para substituí-lo.`
                  : "O contrato passa a valer já. Confira os dados antes de salvar."
                : "O rascunho não vale ainda; ative quando o acordo estiver fechado."
            }
          >
            <select
              name="status"
              value={initialStatus}
              onChange={(event) => setInitialStatus(event.target.value as "rascunho" | "vigente")}
              className={CONTROL}
              {...ariaFor("status", true, err("status"))}
            >
              <option value="rascunho">Rascunho</option>
              <option value="vigente">Vigente</option>
            </select>
          </FormField>
        </fieldset>
      )}

      <fieldset className="border-0 p-0 m-0 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="sr-only">Plano e valor</legend>
        <FormField label="Plano" name="planName" error={err("planName")} className="sm:col-span-2 lg:col-span-1">
          <Input
            name="planName"
            defaultValue={values.planName}
            maxLength={CONTRACT_LIMITS.planName}
            required
            {...ariaFor("planName", false, err("planName"))}
          />
        </FormField>

        <FormField label="Ciclo de cobrança" name="billingCycle" error={err("billingCycle")}>
          <select
            name="billingCycle"
            value={cycle}
            onChange={(event) => setCycle(event.target.value as typeof cycle)}
            className={CONTROL}
            {...ariaFor("billingCycle", false, err("billingCycle"))}
          >
            {BILLING_CYCLES.map((option) => (
              <option key={option} value={option}>
                {CYCLE_LABEL[option]}
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          label="Valor de cada ciclo (R$)"
          name="priceReais"
          error={err("priceReais")}
          hint={
            equivalent !== null
              ? `Equivale a ${formatCents(equivalent)} por mês.`
              : "Pode ser 0,00 (contrato sem cobrança)."
          }
        >
          <Input
            name="priceReais"
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            required
            {...ariaFor("priceReais", true, err("priceReais"))}
          />
        </FormField>

        <FormField
          label="Cota de atletas"
          name="maxAthletes"
          error={err("maxAthletes")}
          hint={`Vazio = cota padrão do plano (${defaultQuota} atletas).`}
        >
          <Input
            name="maxAthletes"
            type="number"
            min={1}
            max={CONTRACT_LIMITS.maxAthletes}
            inputMode="numeric"
            defaultValue={values.maxAthletes}
            placeholder={`padrão: ${defaultQuota}`}
            {...ariaFor("maxAthletes", true, err("maxAthletes"))}
          />
        </FormField>
      </fieldset>

      <fieldset className="border-0 p-0 m-0 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="sr-only">Período</legend>
        <FormField label="Início" name="startsOn" error={err("startsOn")}>
          <Input
            name="startsOn"
            type="date"
            value={startsOn}
            onChange={(event) => setStartsOn(event.target.value)}
            required
            {...ariaFor("startsOn", false, err("startsOn"))}
          />
        </FormField>

        <FormField
          label="Fim"
          name="endsOn"
          error={err("endsOn")}
          hint={
            <>
              Vazio = prazo indeterminado.{" "}
              {suggestion && suggestion !== endsOn && (
                <button
                  type="button"
                  onClick={() => setEndsOn(suggestion)}
                  className="underline font-semibold text-ink-soft tap-expand"
                >
                  Usar o fim do ciclo
                </button>
              )}
            </>
          }
        >
          <Input
            name="endsOn"
            type="date"
            value={endsOn}
            onChange={(event) => setEndsOn(event.target.value)}
            {...ariaFor("endsOn", true, err("endsOn"))}
          />
        </FormField>

        <FormField label="Renova sozinho?" name="autoRenew" error={err("autoRenew")}>
          <select
            name="autoRenew"
            defaultValue={values.autoRenew}
            className={CONTROL}
            {...ariaFor("autoRenew", false, err("autoRenew"))}
          >
            <option value="true">Sim</option>
            <option value="false">Não</option>
          </select>
        </FormField>
      </fieldset>

      <fieldset className="border-0 p-0 m-0 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="sr-only">Assinatura</legend>
        <FormField label="Assinado em" name="signedOn" error={err("signedOn")}>
          <Input name="signedOn" type="date" defaultValue={values.signedOn} {...ariaFor("signedOn", false, err("signedOn"))} />
        </FormField>
        <FormField label="Quem assinou" name="signerName" error={err("signerName")}>
          <Input
            name="signerName"
            defaultValue={values.signerName}
            maxLength={CONTRACT_LIMITS.signerName}
            autoComplete="off"
            {...ariaFor("signerName", false, err("signerName"))}
          />
        </FormField>
        <FormField label="Cargo" name="signerRole" error={err("signerRole")}>
          <Input
            name="signerRole"
            defaultValue={values.signerRole}
            maxLength={CONTRACT_LIMITS.signerRole}
            autoComplete="off"
            {...ariaFor("signerRole", false, err("signerRole"))}
          />
        </FormField>
        <FormField label="Versão dos termos" name="termsVersion" error={err("termsVersion")}>
          <Input
            name="termsVersion"
            defaultValue={values.termsVersion}
            maxLength={CONTRACT_LIMITS.termsVersion}
            placeholder="ex.: 2026-10"
            {...ariaFor("termsVersion", false, err("termsVersion"))}
          />
        </FormField>
      </fieldset>

      <FormField
        label="Notas internas"
        name="notes"
        error={err("notes")}
        hint="Só a equipe da plataforma vê. Não ficam inteiras na trilha de auditoria (só o começo)."
      >
        <textarea
          name="notes"
          rows={4}
          defaultValue={values.notes}
          maxLength={CONTRACT_LIMITS.notes}
          className={cn(CONTROL, "resize-y")}
          {...ariaFor("notes", true, err("notes"))}
        />
      </FormField>

      {confirm && (
        <div role="group" aria-label="Confirmar substituição" aria-live="polite" className="rounded-sm border border-amber bg-[#FFFBE6] p-3.5 flex flex-col gap-2.5">
          <p className="m-0 text-[13px]">
            O clube já tem o <b>{contractCode(confirm.currentNumber)}</b> vigente. Confirmando, ele é encerrado
            como substituído por este contrato, e este passa a valer.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="solid" size="sm" type="button" disabled={pending} onClick={() => void send(true)}>
              {pending ? "Substituindo…" : "Confirmar substituição"}
            </Button>
            <Button variant="ghost" size="sm" type="button" disabled={pending} onClick={() => setConfirm(null)}>
              Voltar
            </Button>
          </div>
        </div>
      )}

      {error && !confirm && (
        <div role="alert" className="text-[13px] text-clay font-medium">
          <p className="m-0">{error}</p>
          {orphanDraft && (
            <p className="m-0 mt-1">
              <Link href={`/admin/contratos/${orphanDraft}`} className="underline font-semibold">
                Abrir o rascunho criado
              </Link>
            </p>
          )}
        </div>
      )}
      {warning && (
        <p role="alert" className="text-[12.5px] font-medium m-0 px-3 py-2 rounded-sm border border-amber bg-[#FFFBE6]">
          {warning}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2.5">
        <Button variant="solid" size="md" type="submit" disabled={pending}>
          {pending ? "Salvando…" : creating ? "Criar contrato" : "Salvar alterações"}
        </Button>
        {creating && (
          <Link
            href="/admin/contratos"
            className="text-[13px] font-semibold text-ink-soft underline px-1 py-2.5 pointer-coarse:min-h-11 pointer-coarse:inline-flex pointer-coarse:items-center"
          >
            Cancelar
          </Link>
        )}
        {saved && (
          <span role="status" className="text-[12.5px] font-semibold">
            ✓ salvo
          </span>
        )}
      </div>
    </form>
  );
}
