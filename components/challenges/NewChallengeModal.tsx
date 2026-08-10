"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { createChallenge } from "@/lib/actions/challenges";
import { useFormModal } from "@/lib/utils/useFormModal";
import {
  CHALLENGE_TIERS,
  CHALLENGE_TIER_DEFAULT_POINTS,
  CHALLENGE_TIER_ICON,
  type ChallengeTier,
} from "@/lib/data/challengeTiers";
import { SWOT_POSITIONS } from "@/lib/data/swotCatalog";

export function NewChallengeModal({
  athletes,
}: {
  athletes: { id: string; full_name: string }[];
}) {
  const { open, setOpen, pending, error, formRef, handleSubmit } = useFormModal(createChallenge);
  const [tier, setTier] = useState<ChallengeTier>("Bronze");

  return (
    <>
      <Button variant="solid" size="sm" onClick={() => setOpen(true)}>
        + Novo desafio
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Novo desafio">
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field label="Título">
            <Input name="title" required placeholder="Ex: 10 finalizações com a perna canhota" />
          </Field>
          <Field label="Descrição">
            <textarea
              name="description"
              required
              rows={3}
              placeholder="O que o atleta precisa gravar e postar no Instagram"
              className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm resize-none"
            />
          </Field>
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Dificuldade">
              <select
                name="tier"
                value={tier}
                onChange={(e) => setTier(e.target.value as ChallengeTier)}
                className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
              >
                {CHALLENGE_TIERS.map((t) => (
                  <option key={t} value={t}>
                    {CHALLENGE_TIER_ICON[t]} {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Pontos">
              <Input
                name="points"
                type="number"
                min={1}
                required
                defaultValue={CHALLENGE_TIER_DEFAULT_POINTS[tier]}
                key={tier}
              />
            </Field>
          </div>
          <Field label="Atleta (opcional)">
            <select
              name="athleteId"
              defaultValue=""
              className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
            >
              <option value="">Todos os atletas</option>
              {athletes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Posição alvo (opcional)">
            <select
              name="targetPosition"
              defaultValue=""
              className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
            >
              <option value="">Todas as posições</option>
              {SWOT_POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          {error && <div className="text-clay text-[12.5px] font-medium">{error}</div>}
          <div className="flex justify-end gap-2.5 mt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="solid" disabled={pending}>
              {pending ? "Salvando…" : "Criar desafio"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
