"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { updatePartnerClubColors } from "@/lib/actions/partnerClubs";
import { useFormModal } from "@/lib/utils/useFormModal";

export function EditPartnerClubColorsModal({
  partnerClubId,
  clubName,
  color1,
  color2,
  color3,
}: {
  partnerClubId: string;
  clubName: string;
  color1: string | null;
  color2: string | null;
  color3: string | null;
}) {
  const { open, setOpen, pending, error, formRef, handleSubmit } = useFormModal((formData) =>
    updatePartnerClubColors(partnerClubId, formData),
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex gap-1"
        aria-label={`Editar cores de ${clubName}`}
      >
        {[color1 ?? "#e5e5e5", color2 ?? "#e5e5e5", color3 ?? "#e5e5e5"].map((c, i) => (
          <span
            key={i}
            className="w-4 h-4 rounded-full border border-line"
            style={{ background: c }}
          />
        ))}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Cores de ${clubName}`}>
        <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field label="Paleta de cores">
            <div className="flex gap-2.5">
              <input
                type="color"
                name="color1"
                defaultValue={color1 ?? "#111111"}
                className="w-12 h-9 rounded-sm border border-line"
              />
              <input
                type="color"
                name="color2"
                defaultValue={color2 ?? "#FFD600"}
                className="w-12 h-9 rounded-sm border border-line"
              />
              <input
                type="color"
                name="color3"
                defaultValue={color3 ?? "#D72B2B"}
                className="w-12 h-9 rounded-sm border border-line"
              />
            </div>
          </Field>
          {error && <div className="text-clay text-[12.5px] font-medium">{error}</div>}
          <div className="flex justify-end gap-2.5 mt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="solid" disabled={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
