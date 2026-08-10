"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { updateExpense } from "@/lib/actions/expenses";

export function EditExpenseModal({
  id,
  categories,
  professionals,
  categoryId,
  professionalId,
  description,
  amountCents,
  notes,
  open,
  onClose,
}: {
  id: string;
  categories: { id: string; name: string; requiresProfessional: boolean }[];
  professionals: { id: string; full_name: string }[];
  categoryId: string | null;
  professionalId: string | null;
  description: string;
  amountCents: number;
  notes: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryChoice, setCategoryChoice] = useState(categoryId ?? "");
  const requiresProfessional =
    categories.find((c) => c.id === categoryChoice)?.requiresProfessional ?? false;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const result = await updateExpense(id, formData);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Editar despesa">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Categoria">
          <select
            name="categoryId"
            value={categoryChoice}
            onChange={(e) => setCategoryChoice(e.target.value)}
            className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
          >
            <option value="">Sem categoria</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        {requiresProfessional && (
          <Field label="Profissional">
            <select
              name="professionalId"
              required
              defaultValue={professionalId ?? ""}
              className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
            >
              <option value="" disabled>
                Selecione o profissional...
              </option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Descrição">
          <Input name="description" required defaultValue={description} />
        </Field>
        <Field label="Valor (R$)">
          <Input
            name="amount"
            required
            inputMode="decimal"
            defaultValue={(amountCents / 100).toFixed(2).replace(".", ",")}
          />
        </Field>
        <Field label="Observações (opcional)">
          <Input name="notes" defaultValue={notes ?? ""} />
        </Field>
        {error && <div className="text-clay text-[12.5px] font-medium">{error}</div>}
        <div className="flex justify-end gap-2.5 mt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="solid" disabled={pending}>
            {pending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
