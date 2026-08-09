"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { createMeeting } from "@/lib/actions/agenda";
import { useFormModal } from "@/lib/utils/useFormModal";
import { getFocusTagSuggestions } from "@/lib/data/swotCatalog";

export function NewMeetingModal({
  athletes,
  teams,
  plays,
  openSwotItemsByAthlete = {},
  athletePositions = {},
}: {
  athletes: { id: string; full_name: string }[];
  teams: string[];
  plays: { id: string; name: string }[];
  openSwotItemsByAthlete?: Record<string, { id: string; category: string; description: string }[]>;
  athletePositions?: Record<string, string[]>;
}) {
  const { open, setOpen, pending, error, formRef, handleSubmit } = useFormModal(createMeeting);
  const [targetType, setTargetType] = useState<"athlete" | "team">("athlete");
  const [athleteId, setAthleteId] = useState(athletes[0]?.id ?? "");
  const athleteSwotItems = openSwotItemsByAthlete[athleteId] ?? [];
  const focusSuggestions = getFocusTagSuggestions(
    targetType === "athlete" ? (athletePositions[athleteId] ?? []) : [],
  );

  return (
    <>
      <Button variant="solid" onClick={() => setOpen(true)}>
        + Agendar encontro
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Agendar encontro">
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field label="Alvo">
            <select
              name="targetType"
              value={targetType}
              onChange={(e) => setTargetType(e.target.value as "athlete" | "team")}
              className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
            >
              <option value="athlete">Atleta específico</option>
              <option value="team">Time inteiro</option>
            </select>
          </Field>
          {targetType === "athlete" ? (
            <Field label="Atleta">
              <select
                name="athleteId"
                required
                value={athleteId}
                onChange={(e) => setAthleteId(e.target.value)}
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
              <span className="text-[11px] text-ink-faint">
                Cria um encontro individual para cada atleta desse time.
              </span>
            </Field>
          )}
          <Field label="Título">
            <Input name="title" required placeholder="Ex: Feedback de jogo" />
          </Field>
          <Field label="Data">
            <Input name="date" type="date" required />
          </Field>
          <Field label="Horário">
            <Input name="time" type="time" defaultValue="19:30" required />
          </Field>
          <Field label="Formato">
            <select
              name="type"
              className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
            >
              <option value="Presencial">Presencial</option>
              <option value="Videochamada">Videochamada</option>
            </select>
          </Field>
          <Field label="Classificação">
            <select
              key={targetType}
              name="purpose"
              defaultValue={targetType === "team" ? "Treino" : "Específico"}
              className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
            >
              <option value="Treino">Treino coletivo</option>
              <option value="Específico">Atendimento específico</option>
            </select>
          </Field>
          <Field label="Material de preparo (opcional)">
            <select
              name="playId"
              defaultValue=""
              className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
            >
              <option value="">Nenhuma jogada da Mesa Tática</option>
              {plays.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Link de vídeo (opcional)">
            <Input name="materialVideoUrl" placeholder="https://..." />
          </Field>
          <Field label="Foco/Tema (opcional)">
            <Input name="focusTag" list="focus-tag-suggestions" placeholder="Ex: Marcação individual firme" />
            <datalist id="focus-tag-suggestions">
              {focusSuggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </Field>
          {targetType === "athlete" && athleteSwotItems.length > 0 && (
            <Field label="Vincular a um ponto da anamnese (opcional)">
              <select
                name="swotItemId"
                defaultValue=""
                className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
              >
                <option value="">Nenhum</option>
                {athleteSwotItems.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.category} — {it.description}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {error && <div className="text-clay text-[12.5px] font-medium">{error}</div>}
          <div className="flex justify-end gap-2.5 mt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="solid" disabled={pending}>
              {pending ? "Agendando…" : "Agendar"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
