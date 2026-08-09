"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { assignSubStaff, removeSubStaff } from "@/lib/actions/partnerClubs";
import { STAFF_ROLE_TITLES } from "@/lib/data/staffRoleTitles";

export function SubStaffModal({
  categoryId,
  categoryName,
  staffList,
  assignments,
}: {
  categoryId: string;
  categoryName: string;
  staffList: { id: string; full_name: string; title: string | null }[];
  assignments: { staffProfileId: string; roleTitle: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const roleByStaff = new Map(assignments.map((a) => [a.staffProfileId, a.roleTitle]));

  async function assign(staffProfileId: string, roleTitle: string) {
    setPendingId(staffProfileId);
    const fd = new FormData();
    fd.set("categoryId", categoryId);
    fd.set("staffProfileId", staffProfileId);
    fd.set("roleTitle", roleTitle);
    await assignSubStaff(fd);
    setPendingId(null);
    router.refresh();
  }

  async function remove(staffProfileId: string) {
    setPendingId(staffProfileId);
    await removeSubStaff(categoryId, staffProfileId);
    setPendingId(null);
    router.refresh();
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        👤 Equipe{assignments.length > 0 ? ` (${assignments.length})` : ""}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Comissão técnica — ${categoryName}`}>
        <p className="text-[13px] text-ink-soft mt-0 mb-3">
          Quem cuida deste sub e com qual função. Isso só documenta a comissão técnica — o acesso
          aos dados de cada atleta continua sendo concedido em Equipe.
        </p>
        {staffList.length === 0 ? (
          <EmptyState icon="🧑‍⚕️" message="Nenhum profissional convidado ainda." />
        ) : (
          <div className="flex flex-col max-h-[50vh] overflow-y-auto">
            {staffList.map((s) => {
              const currentRole = roleByStaff.get(s.id);
              const isAssigned = currentRole != null;
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-2.5 py-2 border-b border-line last:border-b-0 text-sm flex-wrap"
                >
                  <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-[140px]">
                    <input
                      type="checkbox"
                      checked={isAssigned}
                      disabled={pendingId === s.id}
                      onChange={() =>
                        isAssigned ? remove(s.id) : assign(s.id, STAFF_ROLE_TITLES[0])
                      }
                      className="w-4 h-4"
                    />
                    {s.full_name}
                  </label>
                  {isAssigned && (
                    <select
                      value={currentRole}
                      disabled={pendingId === s.id}
                      onChange={(e) => assign(s.id, e.target.value)}
                      className="px-2 py-1 border border-line rounded-sm text-xs bg-white"
                    >
                      {STAFF_ROLE_TITLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className="flex justify-end mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Fechar
          </Button>
        </div>
      </Modal>
    </>
  );
}
