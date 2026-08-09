"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  setLineupStatus,
  setLineupNotes,
  updateLineupMaterial,
  publishLineup,
  unpublishLineup,
} from "@/lib/actions/games";

type Athlete = {
  id: string;
  full_name: string;
  jersey_num: number | null;
  photo_color: string | null;
  position: string[] | null;
};
type LineupRow = { athlete_id: string; status: "Titular" | "Reserva" | "Convocado"; notes: string | null };
type Status = LineupRow["status"];

const STATUS_OPTIONS: { value: Status; label: string; tone: "green" | "sky" | "amber" }[] = [
  { value: "Titular", label: "Titular", tone: "green" },
  { value: "Reserva", label: "Reserva", tone: "sky" },
  { value: "Convocado", label: "Convocado", tone: "amber" },
];

export function LineupClient({
  gameId,
  roster,
  lineup,
  plays,
  initialPlayId,
  initialVideoUrl,
  published,
}: {
  gameId: string;
  roster: Athlete[];
  lineup: LineupRow[];
  plays: { id: string; name: string }[];
  initialPlayId: string | null;
  initialVideoUrl: string | null;
  published: boolean;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [openNotesFor, setOpenNotesFor] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const statusByAthlete = new Map(lineup.map((l) => [l.athlete_id, l.status]));
  const notesByAthlete = new Map(lineup.map((l) => [l.athlete_id, l.notes ?? ""]));

  async function toggleStatus(athleteId: string, status: Status) {
    setPendingId(athleteId);
    const current = statusByAthlete.get(athleteId);
    await setLineupStatus(gameId, athleteId, current === status ? null : status);
    setPendingId(null);
    router.refresh();
  }

  async function saveNotes(athleteId: string, notes: string) {
    setPendingId(athleteId);
    await setLineupNotes(gameId, athleteId, notes);
    setPendingId(null);
    setOpenNotesFor(null);
    router.refresh();
  }

  async function handlePublishToggle() {
    setPublishing(true);
    if (published) {
      await unpublishLineup(gameId);
    } else {
      await publishLineup(gameId);
    }
    setPublishing(false);
    router.refresh();
  }

  async function handleMaterialSubmit(formData: FormData) {
    await updateLineupMaterial(formData);
    router.refresh();
  }

  const titularCount = [...statusByAthlete.values()].filter((s) => s === "Titular").length;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h3 className="m-0 text-base">Material de preparo</h3>
            <div className="text-xs text-ink-faint mt-0.5">
              Jogada da mesa tática e/ou vídeo pros convocados já começarem a estudar.
            </div>
          </div>
        </div>
        <form action={handleMaterialSubmit} className="grid sm:grid-cols-2 gap-2.5">
          <input type="hidden" name="gameId" value={gameId} />
          <Field label="Jogada da mesa tática (opcional)">
            <select
              name="playId"
              defaultValue={initialPlayId ?? ""}
              className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
            >
              <option value="">Nenhuma</option>
              {plays.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Link de vídeo (opcional)">
            <Input name="videoUrl" defaultValue={initialVideoUrl ?? ""} placeholder="https://..." />
          </Field>
          <div className="sm:col-span-2 flex justify-end">
            <Button type="submit" variant="outline" size="sm">
              Salvar material
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3.5 flex-wrap gap-2">
          <div>
            <h3 className="m-0 text-base">Escalação · {titularCount} titular{titularCount === 1 ? "" : "es"}</h3>
            <div className="text-xs text-ink-faint mt-0.5">
              Marque titular, reserva ou convocado. Nota individual é visível só pro atleta
              marcado.
            </div>
          </div>
          <Button variant="solid" onClick={handlePublishToggle} disabled={publishing}>
            {publishing
              ? "Salvando…"
              : published
                ? "Despublicar"
                : "Publicar escalação e notificar atletas"}
          </Button>
        </div>

        {roster.length === 0 ? (
          <EmptyState icon="👥" message="Nenhum atleta neste elenco." />
        ) : (
          <div className="flex flex-col">
            {roster.map((a) => {
              const status = statusByAthlete.get(a.id);
              const notes = notesByAthlete.get(a.id) ?? "";
              return (
                <div key={a.id} className="border-b border-line last:border-b-0 py-2.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center font-display text-xs shrink-0"
                      style={{ background: a.photo_color ?? "#111", color: "#FFD600" }}
                    >
                      {a.jersey_num ?? "—"}
                    </div>
                    <div className="flex-1 min-w-[140px]">
                      <b className="text-sm block">{a.full_name}</b>
                      <span className="text-[11px] text-ink-faint">
                        {a.position?.join(", ") || "—"}
                      </span>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {STATUS_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          disabled={pendingId === a.id}
                          onClick={() => toggleStatus(a.id, opt.value)}
                          className={
                            status === opt.value
                              ? ""
                              : "opacity-40 hover:opacity-70 transition-opacity"
                          }
                        >
                          <Badge tone={opt.tone}>{opt.label}</Badge>
                        </button>
                      ))}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setOpenNotesFor(openNotesFor === a.id ? null : a.id)}
                    >
                      📝 {notes ? "Nota" : "+ Nota"}
                    </Button>
                  </div>
                  {openNotesFor === a.id && (
                    <div className="mt-2 pl-[42px] flex gap-2 items-start">
                      <textarea
                        defaultValue={notes}
                        id={`notes-${a.id}`}
                        rows={2}
                        placeholder="Instrução individual pra este atleta neste jogo..."
                        className="flex-1 px-3 py-2 border border-line rounded-sm resize-y text-sm"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pendingId === a.id}
                        onClick={() => {
                          const el = document.getElementById(
                            `notes-${a.id}`,
                          ) as HTMLTextAreaElement | null;
                          saveNotes(a.id, el?.value ?? "");
                        }}
                      >
                        Salvar
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
