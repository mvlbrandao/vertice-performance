"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { updateInjury, deleteInjury } from "@/lib/actions/injuries";
import {
  INJURY_SEVERITY_META,
  INJURY_STATUS_TONE,
  INJURY_STATUSES,
  INJURY_SEVERITIES,
} from "@/lib/data/injuries";

type Injury = {
  id: string;
  athlete_id: string;
  source: string;
  body_region: string;
  injury_type: string;
  severity: (typeof INJURY_SEVERITIES)[number];
  description: string | null;
  occurred_at: string;
  expected_return_date: string | null;
  status: (typeof INJURY_STATUSES)[number];
  treatment_notes: string | null;
  game: { opponent: string; scheduled_date: string } | null;
};

const selectClass =
  "px-2.5 py-1.5 border border-line rounded-sm bg-white text-xs focus:outline focus:outline-2 focus:outline-amber focus:outline-offset-1 focus:border-amber";

export function InjuryCard({ injury }: { injury: Injury }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const severityMeta = INJURY_SEVERITY_META[injury.severity];

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const result = await updateInjury(injury.id, injury.athlete_id, formData);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("Excluir este registro de lesão?")) return;
    await deleteInjury(injury.id, injury.athlete_id);
    router.refresh();
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-2 flex-wrap mb-2">
        <div>
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <b className="text-sm">{injury.body_region}</b>
            <span className="text-xs text-ink-faint">· {injury.injury_type}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge tone={severityMeta.tone}>{injury.severity}</Badge>
            <Badge tone={INJURY_STATUS_TONE[injury.status]}>{injury.status}</Badge>
            <span className="text-[11px] text-ink-faint">
              {injury.source === "Jogo" && injury.game
                ? `Em jogo vs. ${injury.game.opponent} · ${injury.game.scheduled_date}`
                : `Avulso · ${injury.occurred_at}`}
            </span>
          </div>
        </div>
        <div className="flex gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => setEditing((v) => !v)}>
            {editing ? "Fechar" : "✏️ Atualizar"}
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete}>
            Excluir
          </Button>
        </div>
      </div>

      {injury.description && (
        <p className="text-[12.5px] text-ink-soft m-0 mb-2">{injury.description}</p>
      )}

      {injury.expected_return_date && injury.status !== "Recuperado" && (
        <p className="text-[12.5px] text-ink-faint m-0 mb-2">
          Previsão de retorno: <b>{injury.expected_return_date}</b>
        </p>
      )}

      {injury.treatment_notes && !editing && (
        <div className="bg-chalk border border-line rounded-sm px-3 py-2 text-[12.5px] text-ink-soft mt-2">
          🩹 {injury.treatment_notes}
        </div>
      )}

      {editing && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 mt-3 pt-3 border-t border-line">
          <div className="grid grid-cols-2 gap-2.5">
            <select name="status" defaultValue={injury.status} className={selectClass}>
              {INJURY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              name="expectedReturnDate"
              type="date"
              defaultValue={injury.expected_return_date ?? ""}
              className={selectClass}
            />
          </div>
          <textarea
            name="treatmentNotes"
            rows={2}
            defaultValue={injury.treatment_notes ?? ""}
            placeholder="Notas de tratamento / acompanhamento..."
            className="px-2.5 py-2 border border-line rounded-sm bg-white text-xs resize-none focus:outline focus:outline-2 focus:outline-amber focus:outline-offset-1 focus:border-amber"
          />
          {error && <div className="text-clay text-[12px] font-medium">{error}</div>}
          <div className="flex justify-end">
            <Button type="submit" variant="solid" size="sm" disabled={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
