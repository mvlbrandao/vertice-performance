"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { createInjury } from "@/lib/actions/injuries";
import { useFormModal } from "@/lib/utils/useFormModal";
import {
  INJURY_BODY_REGIONS,
  INJURY_TYPES,
  INJURY_SEVERITIES,
  INJURY_SEVERITY_META,
} from "@/lib/data/injuries";

const selectClass =
  "w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm focus:outline focus:outline-2 focus:outline-amber focus:outline-offset-1 focus:border-amber";

export function NewInjuryModal({
  athleteId,
  games,
}: {
  athleteId: string;
  games: { id: string; opponent: string; scheduled_date: string }[];
}) {
  const { open, setOpen, pending, error, formRef, handleSubmit } = useFormModal(createInjury);
  const [source, setSource] = useState<"Jogo" | "Avulso">("Avulso");

  return (
    <>
      <Button variant="solid" size="sm" onClick={() => setOpen(true)}>
        + Nova lesão
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Registrar lesão">
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input type="hidden" name="athleteId" value={athleteId} />
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Origem">
              <select
                name="source"
                value={source}
                onChange={(e) => setSource(e.target.value as "Jogo" | "Avulso")}
                className={selectClass}
              >
                <option value="Avulso">Avulso (treino/outro)</option>
                <option value="Jogo">Jogo</option>
              </select>
            </Field>
            <Field label="Data">
              <Input name="occurredAt" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
            </Field>
          </div>
          {source === "Jogo" && (
            <Field label="Qual jogo">
              <select name="gameId" required className={selectClass} defaultValue="">
                <option value="" disabled>
                  Selecione o jogo…
                </option>
                {games.map((g) => (
                  <option key={g.id} value={g.id}>
                    vs. {g.opponent} · {g.scheduled_date}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Região do corpo">
              <select name="bodyRegion" required className={selectClass} defaultValue="">
                <option value="" disabled>
                  Selecione…
                </option>
                {INJURY_BODY_REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tipo de lesão">
              <select name="injuryType" required className={selectClass} defaultValue="">
                <option value="" disabled>
                  Selecione…
                </option>
                {INJURY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Gravidade">
            <select name="severity" required className={selectClass} defaultValue="">
              <option value="" disabled>
                Selecione…
              </option>
              {INJURY_SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s} — {INJURY_SEVERITY_META[s].hint}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Descrição (opcional)">
            <textarea
              name="description"
              rows={2}
              className="px-3 py-2.5 border border-line rounded-sm bg-white text-sm focus:outline focus:outline-2 focus:outline-amber focus:outline-offset-1 focus:border-amber resize-none"
              placeholder="Como aconteceu, sintomas relatados..."
            />
          </Field>
          <Field label="Previsão de retorno (opcional)">
            <Input name="expectedReturnDate" type="date" />
          </Field>
          {error && <div className="text-clay text-[12.5px] font-medium">{error}</div>}
          <div className="flex justify-end gap-2.5 mt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="solid" disabled={pending}>
              {pending ? "Salvando…" : "Registrar"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
