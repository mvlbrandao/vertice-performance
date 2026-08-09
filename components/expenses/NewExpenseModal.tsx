"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { createExpense, createExpenseCategory } from "@/lib/actions/expenses";
import { useFormModal } from "@/lib/utils/useFormModal";

const NEW_CATEGORY = "__nova__";

export function NewExpenseModal({
  categories,
}: {
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { open, setOpen, pending, error, formRef, handleSubmit } = useFormModal(createExpense);
  const [categoryChoice, setCategoryChoice] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const isNewCategory = categoryChoice === NEW_CATEGORY;

  const [categoryPending, setCategoryPending] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);

  async function handleSaveCategory() {
    if (!newCategoryName.trim()) return;
    setCategoryPending(true);
    setCategoryError(null);
    const fd = new FormData();
    fd.set("name", newCategoryName.trim());
    const result = await createExpenseCategory(fd);
    setCategoryPending(false);
    if (result.error) {
      setCategoryError(result.error);
      return;
    }
    // categoria criada; volta pro select (agora atualizado) pra escolher a
    // categoria nova antes de lançar a despesa em si.
    setCategoryChoice("");
    setNewCategoryName("");
    router.refresh();
  }

  return (
    <>
      <Button variant="solid" size="sm" onClick={() => setOpen(true)}>
        + Nova despesa
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Nova despesa">
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
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
              <option value={NEW_CATEGORY}>+ Nova categoria...</option>
            </select>
          </Field>
          {isNewCategory && (
            <Field label="Nome da nova categoria">
              <div className="flex gap-2">
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Ex: Material médico"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSaveCategory}
                  disabled={categoryPending || !newCategoryName.trim()}
                >
                  {categoryPending ? "Salvando…" : "Adicionar"}
                </Button>
              </div>
              {categoryError && (
                <div className="text-clay text-[12.5px] font-medium mt-1">{categoryError}</div>
              )}
            </Field>
          )}
          <Field label="Descrição">
            <Input name="description" required placeholder="Ex: Aluguel do campo — agosto" />
          </Field>
          <Field label="Valor (R$)">
            <Input name="amount" required inputMode="decimal" placeholder="Ex: 800,00" />
          </Field>
          <Field label="Vencimento">
            <Input name="dueDate" type="date" required />
          </Field>
          <Field label="Observações (opcional)">
            <Input name="notes" placeholder="Ex: Pagamento combinado com o síndico" />
          </Field>
          {error && <div className="text-clay text-[12.5px] font-medium">{error}</div>}
          <div className="flex justify-end gap-2.5 mt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            {!isNewCategory && (
              <Button type="submit" variant="solid" disabled={pending}>
                {pending ? "Lançando…" : "Lançar despesa"}
              </Button>
            )}
          </div>
        </form>
      </Modal>
    </>
  );
}
