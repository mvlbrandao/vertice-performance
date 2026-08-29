"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { approveEnrollment } from "@/lib/actions/enrollment";
import { useFormModal } from "@/lib/utils/useFormModal";

export function ApproveEnrollmentModal({
  requestId,
  fullName,
  requestedTeam,
  requestedCategory,
  teams,
}: {
  requestId: string;
  fullName: string;
  requestedTeam: string | null;
  requestedCategory: string | null;
  teams: { name: string; categories: string[] }[];
}) {
  const { open, setOpen, pending, error, formRef, handleSubmit } = useFormModal(approveEnrollment);
  const [selectedTeam, setSelectedTeam] = useState(requestedTeam ?? "");
  const availableCategories = teams.find((t) => t.name === selectedTeam)?.categories ?? [];

  return (
    <>
      <Button variant="solid" size="sm" onClick={() => setOpen(true)}>
        ✅ Aprovar
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Aprovar matrícula — ${fullName}`}>
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input type="hidden" name="requestId" value={requestId} />
          <p className="text-[12.5px] text-ink-soft m-0">
            Confirme o time e a categoria antes de criar o atleta. A cobrança no Asaas não começa
            aqui — configure depois na ficha financeira do atleta.
          </p>
          {teams.length > 0 ? (
            <>
              <Field label="Time">
                <select
                  name="team"
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
                >
                  <option value="">Sem time definido</option>
                  {teams.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Categoria">
                <select
                  key={selectedTeam}
                  name="category"
                  defaultValue={requestedCategory ?? ""}
                  disabled={!selectedTeam || availableCategories.length === 0}
                  className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm disabled:opacity-50"
                >
                  <option value="">Sem categoria definida</option>
                  {availableCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          ) : (
            <p className="text-[12.5px] text-ink-faint m-0">
              Solicitado: {requestedTeam ?? "—"} {requestedCategory ? `/ ${requestedCategory}` : ""}
            </p>
          )}
          {error && <div className="text-clay text-[12.5px] font-medium">{error}</div>}
          <div className="flex justify-end gap-2.5 mt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="solid" disabled={pending}>
              {pending ? "Criando…" : "Aprovar e criar atleta"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
