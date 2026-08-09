"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { createGame } from "@/lib/actions/games";
import { useFormModal } from "@/lib/utils/useFormModal";

export function NewGameModal({
  competitionId,
  competitionName,
  athletes,
  teams,
  partnerClubNames,
}: {
  competitionId: string;
  competitionName: string;
  athletes: { id: string; full_name: string }[];
  teams: string[];
  partnerClubNames: string[];
}) {
  const { open, setOpen, pending, error, formRef, handleSubmit } = useFormModal(createGame);
  const [targetType, setTargetType] = useState<"athlete" | "team">("team");
  const [opponentMode, setOpponentMode] = useState<"club" | "other">(
    partnerClubNames.length > 0 ? "club" : "other",
  );

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        + Jogo
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Novo jogo — ${competitionName}`}>
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input type="hidden" name="competitionId" value={competitionId} />
          {partnerClubNames.length > 0 && (
            <Field label="Adversário é">
              <select
                value={opponentMode}
                onChange={(e) => setOpponentMode(e.target.value as "club" | "other")}
                className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
              >
                <option value="club">Um clube cadastrado</option>
                <option value="other">Outro (digitar nome)</option>
              </select>
            </Field>
          )}
          <Field label="Adversário">
            {opponentMode === "club" && partnerClubNames.length > 0 ? (
              <select
                name="opponent"
                required
                className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
              >
                {partnerClubNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            ) : (
              <Input name="opponent" required placeholder="Ex: Flamengo Sub-12" />
            )}
          </Field>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Data">
              <Input name="scheduledDate" type="date" required />
            </Field>
            <Field label="Horário (opcional)">
              <Input name="scheduledTime" type="time" />
            </Field>
          </div>
          <Field label="Local (opcional)">
            <Input name="location" placeholder="Ex: Ginásio Municipal" />
          </Field>
          <Field label="Alvo">
            <select
              name="targetType"
              value={targetType}
              onChange={(e) => setTargetType(e.target.value as "athlete" | "team")}
              className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
            >
              <option value="team">Time inteiro</option>
              <option value="athlete">Atleta específico</option>
            </select>
          </Field>
          {targetType === "athlete" ? (
            <Field label="Atleta">
              <select
                name="targetAthleteId"
                required
                className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
              >
                {athletes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="Time">
              {teams.length > 0 ? (
                <select
                  name="targetTeam"
                  required
                  className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
                >
                  {teams.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              ) : (
                <Input name="targetTeam" required placeholder="Ex: Sub-12 A" />
              )}
            </Field>
          )}
          <Field label="Notas (opcional)">
            <Input name="notes" placeholder="Observações sobre o jogo" />
          </Field>
          {error && <div className="text-clay text-[12.5px] font-medium">{error}</div>}
          <div className="flex justify-end gap-2.5 mt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="solid" disabled={pending}>
              {pending ? "Salvando…" : "Cadastrar"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
