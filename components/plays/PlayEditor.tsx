"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { TagInput } from "@/components/ui/TagInput";
import { PlayCourtSVG, type SvgPoint } from "@/components/plays/PlayCourtSVG";
import { createPlay, updatePlay } from "@/lib/actions/plays";
import {
  defaultFrame,
  FORMATIONS,
  SPORT_LABELS,
  type PlayFrame,
  type PlayMarkerKind,
  type PlaySportType,
} from "@/lib/types/plays";

type Mode = "move" | "arrow";

export interface PlayEditorInitial {
  name: string;
  targetType: "athlete" | "team";
  targetAthleteId: string | null;
  targetTeam: string | null;
  videoUrl: string | null;
  description: string | null;
  sportType: PlaySportType;
  tags: string[];
  frames: PlayFrame[];
}

const PLAY_TAG_SUGGESTIONS = [
  "Ataque posicionado",
  "Contra-ataque",
  "Escanteio ofensivo",
  "Escanteio defensivo",
  "Lateral",
  "Saída de bola",
  "Transição defensiva",
  "Bola parada",
  "Marcação",
  "Pressão alta",
];

export function PlayEditor({
  editMode,
  playId,
  athletes,
  teams,
  initialPlay,
}: {
  editMode: "create" | "edit";
  playId?: string;
  athletes: { id: string; full_name: string }[];
  teams: string[];
  initialPlay?: PlayEditorInitial;
}) {
  const router = useRouter();

  const [name, setName] = useState(initialPlay?.name ?? "");
  const [targetType, setTargetType] = useState<"athlete" | "team">(
    initialPlay?.targetType ?? "team",
  );
  const [targetAthleteId, setTargetAthleteId] = useState(
    initialPlay?.targetAthleteId ?? athletes[0]?.id ?? "",
  );
  const [targetTeam, setTargetTeam] = useState(initialPlay?.targetTeam ?? teams[0] ?? "");
  const [videoUrl, setVideoUrl] = useState(initialPlay?.videoUrl ?? "");
  const [description, setDescription] = useState(initialPlay?.description ?? "");
  const [tags, setTags] = useState<string[]>(initialPlay?.tags ?? []);
  const [sportType, setSportType] = useState<PlaySportType>(initialPlay?.sportType ?? "futsal");
  const formationNames = Object.keys(FORMATIONS[sportType]);
  const [formation, setFormation] = useState(formationNames[0]);

  const [frames, setFrames] = useState<PlayFrame[]>(initialPlay?.frames ?? [defaultFrame()]);
  const [frameIndex, setFrameIndex] = useState(0);
  const frame = frames[frameIndex];

  const [mode, setMode] = useState<Mode>("move");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingMarkerId, setDraggingMarkerId] = useState<string | null>(null);
  const [arrowStart, setArrowStart] = useState<SvgPoint | null>(null);
  const [arrowPreview, setArrowPreview] = useState<{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null>(null);
  const [dashedArrows, setDashedArrows] = useState(false);

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateFrame(updater: (f: PlayFrame) => PlayFrame) {
    setFrames((prev) => prev.map((f, i) => (i === frameIndex ? updater(f) : f)));
  }

  function handleMarkerDown(markerId: string, point: SvgPoint) {
    setSelectedId(markerId);
    if (mode === "move") {
      setDraggingMarkerId(markerId);
    } else {
      setArrowStart(point);
      setArrowPreview({ x1: point.x, y1: point.y, x2: point.x, y2: point.y });
    }
  }

  function handleCanvasDown(point: SvgPoint) {
    setSelectedId(null);
    if (mode === "arrow") {
      setArrowStart(point);
      setArrowPreview({ x1: point.x, y1: point.y, x2: point.x, y2: point.y });
    }
  }

  function handlePointerMove(point: SvgPoint) {
    if (mode === "move" && draggingMarkerId) {
      updateFrame((f) => ({
        ...f,
        markers: f.markers.map((m) =>
          m.id === draggingMarkerId ? { ...m, x: point.x, y: point.y } : m,
        ),
      }));
    } else if (mode === "arrow" && arrowStart) {
      setArrowPreview({ x1: arrowStart.x, y1: arrowStart.y, x2: point.x, y2: point.y });
    }
  }

  function handlePointerUp(point: SvgPoint) {
    if (mode === "move") {
      setDraggingMarkerId(null);
    } else if (mode === "arrow" && arrowStart) {
      const dist = Math.hypot(point.x - arrowStart.x, point.y - arrowStart.y);
      if (dist > 8) {
        updateFrame((f) => ({
          ...f,
          arrows: [
            ...f.arrows,
            {
              id: crypto.randomUUID(),
              x1: arrowStart.x,
              y1: arrowStart.y,
              x2: point.x,
              y2: point.y,
              dashed: dashedArrows,
            },
          ],
        }));
      }
      setArrowStart(null);
      setArrowPreview(null);
    }
  }

  function addMarker(kind: PlayMarkerKind) {
    updateFrame((f) => {
      if (kind === "ball" && f.markers.some((m) => m.kind === "ball")) return f;
      const ownCount = f.markers.filter((m) => m.kind === kind).length;
      return {
        ...f,
        markers: [
          ...f.markers,
          {
            id: crypto.randomUUID(),
            kind,
            x: kind === "opponent" ? 480 : 120,
            y: 60 + ownCount * 50,
            label: kind === "ball" ? undefined : String(ownCount + 1),
          },
        ],
      };
    });
  }

  function applyFormation() {
    const preset = FORMATIONS[sportType][formation];
    if (!preset) return;
    updateFrame((f) => ({
      ...f,
      markers: [
        ...f.markers.filter((m) => m.kind !== "own"),
        ...preset.map((p, i) => ({
          id: crypto.randomUUID(),
          kind: "own" as const,
          x: p.x,
          y: p.y,
          label: i === 0 ? "G" : String(i + 1),
        })),
      ],
    }));
    setSelectedId(null);
  }

  function removeSelected() {
    if (!selectedId) return;
    updateFrame((f) => ({
      markers: f.markers.filter((m) => m.id !== selectedId),
      arrows: f.arrows.filter((a) => a.id !== selectedId),
    }));
    setSelectedId(null);
  }

  function addFrame() {
    setFrames((prev) => {
      const current = prev[frameIndex];
      const clone: PlayFrame = {
        markers: current.markers.map((m) => ({ ...m })),
        arrows: [],
      };
      const next = [...prev.slice(0, frameIndex + 1), clone, ...prev.slice(frameIndex + 1)];
      return next;
    });
    setFrameIndex((i) => i + 1);
    setSelectedId(null);
  }

  function removeFrame() {
    if (frames.length <= 1) return;
    setFrames((prev) => prev.filter((_, i) => i !== frameIndex));
    setFrameIndex((i) => Math.max(0, i - 1));
    setSelectedId(null);
  }

  async function handleSave() {
    setPending(true);
    setError(null);

    const formData = new FormData();
    formData.set("name", name);
    formData.set("targetType", targetType);
    formData.set("targetAthleteId", targetType === "athlete" ? targetAthleteId : "");
    formData.set("targetTeam", targetType === "team" ? targetTeam : "");
    formData.set("videoUrl", videoUrl);
    formData.set("description", description);
    formData.set("sportType", sportType);
    tags.forEach((t) => formData.append("tags", t));
    formData.set("frames", JSON.stringify(frames));

    const result =
      editMode === "edit" && playId
        ? await updatePlay(playId, formData)
        : await createPlay(formData);

    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.push("/plays");
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Nome da jogada">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Saída de bola pelo pivô" />
          </Field>
          <Field label="Link de vídeo (opcional)">
            <Input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://..."
            />
          </Field>
          <Field label="Esporte">
            <select
              value={sportType}
              onChange={(e) => {
                const next = e.target.value as PlaySportType;
                setSportType(next);
                setFormation(Object.keys(FORMATIONS[next])[0]);
              }}
              className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
            >
              {(Object.keys(SPORT_LABELS) as PlaySportType[]).map((s) => (
                <option key={s} value={s}>
                  {SPORT_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Alvo">
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value as "athlete" | "team")}
              className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
            >
              <option value="team">Time inteiro</option>
              <option value="athlete">Atleta específico</option>
            </select>
          </Field>
          {targetType === "athlete" ? (
            <Field label="Atleta">
              <select
                value={targetAthleteId}
                onChange={(e) => setTargetAthleteId(e.target.value)}
                className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
              >
                {athletes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <Field label="Time">
              {teams.length > 0 ? (
                <select
                  value={targetTeam}
                  onChange={(e) => setTargetTeam(e.target.value)}
                  className="w-full px-3 py-2.5 border border-line rounded-sm bg-white text-sm"
                >
                  {teams.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  value={targetTeam}
                  onChange={(e) => setTargetTeam(e.target.value)}
                  placeholder="Ex: Sub-12 A"
                />
              )}
            </Field>
          )}
          <Field label="Descrição (opcional)" className="md:col-span-2">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contexto rápido sobre quando usar essa jogada"
            />
          </Field>
          <Field label="Tags (opcional)" className="md:col-span-2">
            <TagInput
              name="tags"
              value={tags}
              onChange={setTags}
              suggestions={PLAY_TAG_SUGGESTIONS}
              placeholder="Ex: Escanteio ofensivo"
            />
          </Field>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div className="flex gap-1.5">
            {frames.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setFrameIndex(i);
                  setSelectedId(null);
                }}
                className={`px-3 py-1.5 rounded-sm text-[12.5px] font-semibold border ${
                  i === frameIndex
                    ? "bg-pitch-dark text-chalk border-pitch-dark"
                    : "border-line text-ink-soft"
                }`}
              >
                Quadro {i + 1}
              </button>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addFrame}>
              + Quadro
            </Button>
            {frames.length > 1 && (
              <Button type="button" variant="ghost" size="sm" onClick={removeFrame}>
                Remover quadro
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Button
            type="button"
            variant={mode === "move" ? "solid" : "outline"}
            size="sm"
            onClick={() => setMode("move")}
          >
            ✋ Mover
          </Button>
          <Button
            type="button"
            variant={mode === "arrow" ? "solid" : "outline"}
            size="sm"
            onClick={() => setMode("arrow")}
          >
            ➜ Desenhar seta
          </Button>
          {mode === "arrow" && (
            <label className="flex items-center gap-1.5 text-xs text-ink-soft ml-1">
              <input
                type="checkbox"
                checked={dashedArrows}
                onChange={(e) => setDashedArrows(e.target.checked)}
              />
              Tracejada (passe)
            </label>
          )}
          <span className="w-px h-5 bg-line mx-1" />
          <Button type="button" variant="outline" size="sm" onClick={() => addMarker("own")}>
            + Jogador
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => addMarker("opponent")}>
            + Adversário
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => addMarker("ball")}>
            + Bola
          </Button>
          {selectedId && (
            <Button type="button" variant="danger" size="sm" onClick={removeSelected}>
              Remover selecionado
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-xs font-semibold text-ink-soft uppercase tracking-wide">
            Formação
          </span>
          <select
            value={formation}
            onChange={(e) => setFormation(e.target.value)}
            className="px-2.5 py-1.5 border border-line rounded-sm bg-white text-[12.5px]"
          >
            {formationNames.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <Button type="button" variant="outline" size="sm" onClick={applyFormation}>
            Aplicar formação
          </Button>
        </div>

        <PlayCourtSVG
          frame={frame}
          sportType={sportType}
          interactive
          selectedId={selectedId}
          previewArrow={arrowPreview}
          onMarkerPointerDown={handleMarkerDown}
          onCanvasPointerDown={handleCanvasDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
        <p className="text-xs text-ink-faint mt-2">
          Arraste os marcadores no modo Mover. No modo Desenhar seta, clique e arraste no quadro
          (ou a partir de um marcador) para indicar um movimento.
        </p>
      </Card>

      {error && <div className="text-clay text-[13px] font-medium">{error}</div>}
      <div className="flex justify-end gap-2.5">
        <Button type="button" variant="ghost" onClick={() => router.push("/plays")}>
          Cancelar
        </Button>
        <Button type="button" variant="solid" disabled={pending || !name} onClick={handleSave}>
          {pending ? "Salvando…" : "Salvar jogada"}
        </Button>
      </div>
    </div>
  );
}
