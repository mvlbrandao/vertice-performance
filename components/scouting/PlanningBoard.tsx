"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { initials } from "@/lib/utils/initials";
import { overallColor, scoreStars } from "@/lib/utils/scoreColor";
import type { PlayerScore } from "@/lib/scoring";
import {
  createPlanningColumn,
  deletePlanningColumn,
  moveAthleteCard,
  renamePlanningColumn,
  reorderPlanningColumn,
} from "@/lib/actions/planning";

export interface PlanningColumn {
  id: string;
  name: string;
  position: number;
  color: "dark" | "sky" | "amber" | "clay" | "green";
}

export interface PlanningAthlete {
  id: string;
  fullName: string;
  category: string | null;
  position: string | null;
  photoUrl: string | null;
  photoColor: string | null;
  score: PlayerScore;
  columnId: string | null;
  note: string | null;
  movedAt: string | null;
}

const ALL = "__todos__";
const SEM_ETAPA = "__sem_etapa__";
const CORES: { value: PlanningColumn["color"]; label: string }[] = [
  { value: "dark", label: "Escuro" },
  { value: "sky", label: "Azul" },
  { value: "amber", label: "Âmbar" },
  { value: "clay", label: "Terracota" },
  { value: "green", label: "Verde" },
];

function diasDesde(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function AthleteCard({ athlete }: { athlete: PlanningAthlete }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: athlete.id,
  });
  const dias = diasDesde(athlete.movedAt);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        touchAction: "none",
        ...(transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 20 }
          : undefined),
      }}
      className={`bg-paper border border-line rounded-md p-2.5 cursor-grab active:cursor-grabbing select-none ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        {athlete.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={athlete.photoUrl}
            alt={athlete.fullName}
            className="w-9 h-9 rounded-md object-cover shrink-0"
          />
        ) : (
          <div
            className="w-9 h-9 rounded-md flex items-center justify-center font-display text-xs shrink-0"
            style={{ background: athlete.photoColor ?? "#111", color: "#FFD600" }}
          >
            {initials(athlete.fullName)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <b className="block text-[12.5px] truncate leading-tight">{athlete.fullName}</b>
          <span className="text-[10.5px] text-ink-faint truncate block">
            {[athlete.category, athlete.position].filter(Boolean).join(" · ") || "—"}
          </span>
        </div>
        <div className="flex flex-col items-center shrink-0" style={{ color: overallColor(athlete.score.overall) }}>
          <span className="text-[9px] leading-none">
            {"★".repeat(scoreStars(athlete.score.overall))}
            {"☆".repeat(3 - scoreStars(athlete.score.overall))}
          </span>
          <span className="font-display text-[13px] leading-none mt-0.5">{athlete.score.overall}</span>
        </div>
      </div>
      <div className="flex items-center justify-between pt-1.5 border-t border-line">
        {dias !== null ? (
          <span className={`text-[10px] ${dias >= 21 ? "text-clay font-semibold" : "text-ink-faint"}`}>
            há {dias}d
          </span>
        ) : (
          <span />
        )}
        <Link
          href={`/athletes/${athlete.id}/dados`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="text-[10px] font-bold text-pitch-dark hover:underline"
        >
          Abrir ficha →
        </Link>
      </div>
    </div>
  );
}

function ColumnHeader({
  column,
  count,
  isFirst,
  isLast,
  pending,
  run,
}: {
  column: PlanningColumn;
  count: number;
  isFirst: boolean;
  isLast: boolean;
  pending: boolean;
  run: (action: (fd: FormData) => Promise<{ error?: string }>, fd: FormData) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(column.name);
  const [cor, setCor] = useState<PlanningColumn["color"]>(column.color);

  if (editando) {
    return (
      <div className="flex flex-col gap-1.5 px-2.5 py-2 border-b border-line">
        <Input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="text-[12.5px] py-1.5 px-2"
        />
        <select
          value={cor}
          onChange={(e) => setCor(e.target.value as PlanningColumn["color"])}
          className="px-2 py-1.5 border border-line rounded-sm bg-white text-[12.5px]"
        >
          {CORES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            disabled={pending || !nome.trim()}
            onClick={() => {
              const fd = new FormData();
              fd.set("id", column.id);
              fd.set("name", nome.trim());
              fd.set("color", cor);
              run(renamePlanningColumn, fd);
              setEditando(false);
            }}
          >
            Salvar
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setEditando(false)}>
            Cancelar
          </Button>
          {!isFirst && (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => {
                const fd = new FormData();
                fd.set("id", column.id);
                fd.set("direcao", "subir");
                run(reorderPlanningColumn, fd);
              }}
            >
              ←
            </Button>
          )}
          {!isLast && (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => {
                const fd = new FormData();
                fd.set("id", column.id);
                fd.set("direcao", "descer");
                run(reorderPlanningColumn, fd);
              }}
            >
              →
            </Button>
          )}
          <Button
            variant="danger"
            size="sm"
            disabled={pending || count > 0}
            title={count > 0 ? "Mova os atletas desta coluna antes de removê-la." : undefined}
            onClick={() => {
              const fd = new FormData();
              fd.set("id", column.id);
              run(deletePlanningColumn, fd);
            }}
          >
            Remover
          </Button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditando(true)}
      className="w-full text-left px-2.5 py-2 border-b border-line hover:bg-[#00000006]"
    >
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <Badge tone={column.color}>{column.name}</Badge>
        </div>
        <span className="text-[11px] text-ink-faint font-mono">{count}</span>
      </div>
    </button>
  );
}

function DroppableColumn({
  column,
  cards,
  isFirst,
  isLast,
  pending,
  run,
}: {
  column: PlanningColumn;
  cards: PlanningAthlete[];
  isFirst: boolean;
  isLast: boolean;
  pending: boolean;
  run: (action: (fd: FormData) => Promise<{ error?: string }>, fd: FormData) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div className="flex flex-col w-64 shrink-0 bg-white border border-line rounded-md overflow-hidden">
      <ColumnHeader column={column} count={cards.length} isFirst={isFirst} isLast={isLast} pending={pending} run={run} />
      <div
        ref={setNodeRef}
        className={`flex flex-col gap-2 p-2 min-h-[120px] flex-1 ${isOver ? "bg-[#FFF8CC]" : ""}`}
      >
        {cards.map((a) => (
          <AthleteCard key={a.id} athlete={a} />
        ))}
      </div>
    </div>
  );
}

export function PlanningBoard({
  athletes,
  columns,
}: {
  athletes: PlanningAthlete[];
  columns: PlanningColumn[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [stageByAthlete, setStageByAthlete] = useState<Map<string, string | null>>(
    () => new Map(athletes.map((a) => [a.id, a.columnId])),
  );
  const [category, setCategory] = useState(ALL);
  const [novaColuna, setNovaColuna] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const categories = useMemo(
    () => Array.from(new Set(athletes.map((a) => a.category).filter(Boolean))).sort() as string[],
    [athletes],
  );

  function run(action: (fd: FormData) => Promise<{ error?: string }>, fd: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await action(fd);
      if (result.error) setError(result.error);
    });
  }

  const filtrados = athletes.filter((a) => category === ALL || a.category === category);

  const porColuna = new Map<string, PlanningAthlete[]>();
  for (const col of columns) porColuna.set(col.id, []);
  const semEtapa: PlanningAthlete[] = [];
  for (const a of filtrados) {
    const columnId = stageByAthlete.get(a.id) ?? a.columnId;
    if (columnId && porColuna.has(columnId)) {
      porColuna.get(columnId)!.push({ ...a, columnId });
    } else {
      semEtapa.push(a);
    }
  }

  const draggingAthlete = draggingId ? athletes.find((a) => a.id === draggingId) ?? null : null;

  function handleDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingId(null);
    const { active, over } = event;
    if (!over) return;
    const athleteId = String(active.id);
    const columnId = String(over.id);
    if (!columns.some((c) => c.id === columnId)) return;

    setStageByAthlete((prev) => {
      const next = new Map(prev);
      next.set(athleteId, columnId);
      return next;
    });

    const fd = new FormData();
    fd.set("athleteId", athleteId);
    fd.set("columnId", columnId);
    run(moveAthleteCard, fd);
  }

  return (
    <div>
      <div className="flex items-center gap-2.5 flex-wrap mb-4">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 border border-line rounded-sm bg-white text-[12.5px] font-semibold text-ink-soft"
        >
          <option value={ALL}>Todos os subs</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <span className="text-xs text-ink-faint">{filtrados.length} atletas</span>
      </div>

      {error && <p className="text-clay text-[12.5px] font-medium mb-2">{error}</p>}

      <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex items-start gap-3 overflow-x-auto pb-3">
          {semEtapa.length > 0 && (
            <div className="flex flex-col w-64 shrink-0 bg-white border border-dashed border-line rounded-md overflow-hidden">
              <div className="px-2.5 py-2 border-b border-line flex items-center justify-between">
                <Badge tone="dark">Sem etapa</Badge>
                <span className="text-[11px] text-ink-faint font-mono">{semEtapa.length}</span>
              </div>
              <div id={SEM_ETAPA} className="flex flex-col gap-2 p-2">
                {semEtapa.map((a) => (
                  <AthleteCard key={a.id} athlete={a} />
                ))}
              </div>
            </div>
          )}

          {columns.map((col, i) => (
            <DroppableColumn
              key={col.id}
              column={col}
              cards={porColuna.get(col.id) ?? []}
              isFirst={i === 0}
              isLast={i === columns.length - 1}
              pending={pending}
              run={run}
            />
          ))}

          <div className="flex flex-col gap-1.5 w-56 shrink-0 px-2.5 py-2">
            <Input
              placeholder="Nova coluna"
              value={novaColuna}
              onChange={(e) => setNovaColuna(e.target.value)}
              className="text-[12.5px] py-1.5 px-2"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={pending || !novaColuna.trim()}
              onClick={() => {
                const fd = new FormData();
                fd.set("name", novaColuna.trim());
                run(createPlanningColumn, fd);
                setNovaColuna("");
              }}
            >
              + Nova coluna
            </Button>
          </div>
        </div>

        <DragOverlay>
          {draggingAthlete ? (
            <div className="bg-paper border border-pitch-dark rounded-md px-2.5 py-2 shadow-card w-60">
              <div className="text-[13px] font-semibold truncate">{draggingAthlete.fullName}</div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
