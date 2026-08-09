"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { grantAthleteAccess, revokeAthleteAccess, updateStaffAreas } from "@/lib/actions/staff";
import { STAFF_AREAS } from "@/lib/data/staffAreas";

export function StaffAccessModal({
  staffProfileId,
  staffName,
  athletes,
  grants,
  areas,
}: {
  staffProfileId: string;
  staffName: string;
  athletes: { id: string; full_name: string }[];
  grants: { athleteId: string; accessLevel: "view" | "manage" }[];
  areas: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [areasPending, setAreasPending] = useState(false);
  const [selectedAreas, setSelectedAreas] = useState<string[]>(areas);
  const levelByAthlete = new Map(grants.map((g) => [g.athleteId, g.accessLevel]));

  async function toggleArea(key: string) {
    const next = selectedAreas.includes(key)
      ? selectedAreas.filter((a) => a !== key)
      : [...selectedAreas, key];
    setSelectedAreas(next);
    setAreasPending(true);
    await updateStaffAreas(staffProfileId, next);
    setAreasPending(false);
    router.refresh();
  }

  async function toggle(athleteId: string, currentlyGranted: boolean) {
    setPendingId(athleteId);
    if (currentlyGranted) {
      await revokeAthleteAccess(staffProfileId, athleteId);
    } else {
      await grantAthleteAccess(staffProfileId, athleteId, "manage");
    }
    setPendingId(null);
    router.refresh();
  }

  async function changeLevel(athleteId: string, level: "view" | "manage") {
    setPendingId(athleteId);
    await grantAthleteAccess(staffProfileId, athleteId, level);
    setPendingId(null);
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Gerenciar acesso
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Acesso — ${staffName}`}>
        <div className="mb-4 pb-4 border-b border-line">
          <b className="text-[13px] block mb-1">Áreas liberadas no sistema</b>
          <p className="text-[12.5px] text-ink-soft mt-0 mb-2.5">
            Controla o que {staffName} pode ver/fazer, além de quais atletas — ex.: alguém do
            financeiro não precisa enxergar anamnese ou treino.
          </p>
          <div className="flex flex-wrap gap-2">
            {STAFF_AREAS.map((area) => {
              const checked = selectedAreas.includes(area.key);
              return (
                <label
                  key={area.key}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-sm text-xs font-semibold cursor-pointer ${
                    checked
                      ? "border-pitch-dark bg-pitch-dark text-chalk"
                      : "border-line text-ink-soft"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={areasPending}
                    onChange={() => toggleArea(area.key)}
                    className="sr-only"
                  />
                  {area.icon} {area.label}
                </label>
              );
            })}
          </div>
        </div>
        <p className="text-[13px] text-ink-soft mt-0 mb-3">
          Marque os atletas que {staffName} pode acompanhar. <b>Visualizar</b>: só consulta dados,
          treinos, encontros e notas. <b>Gerenciar</b>: também prescreve treino, agenda encontro e
          registra notas. Nada além disso — sem acesso ao restante do clube.
        </p>
        {athletes.length === 0 ? (
          <EmptyState icon="👥" message="Nenhum atleta cadastrado ainda." />
        ) : (
          <div className="flex flex-col max-h-[50vh] overflow-y-auto">
            {athletes.map((a) => {
              const level = levelByAthlete.get(a.id);
              const isGranted = level != null;
              return (
                <div
                  key={a.id}
                  className="flex items-center gap-2.5 py-2 border-b border-line last:border-b-0 text-sm flex-wrap"
                >
                  <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-[140px]">
                    <input
                      type="checkbox"
                      checked={isGranted}
                      disabled={pendingId === a.id}
                      onChange={() => toggle(a.id, isGranted)}
                      className="w-4 h-4"
                    />
                    {a.full_name}
                  </label>
                  {isGranted && (
                    <select
                      value={level}
                      disabled={pendingId === a.id}
                      onChange={(e) => changeLevel(a.id, e.target.value as "view" | "manage")}
                      className="px-2 py-1 border border-line rounded-sm text-xs bg-white"
                    >
                      <option value="view">Visualizar</option>
                      <option value="manage">Gerenciar</option>
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
