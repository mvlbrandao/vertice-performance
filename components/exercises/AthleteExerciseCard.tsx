"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { toggleExerciseDone, createExerciseVideoRecord } from "@/lib/actions/exercises";
import { uploadExerciseVideo } from "@/lib/storage/upload";

interface VideoRow {
  id: string;
  label: string | null;
  status: string;
  coach_comment: string | null;
  submitted_at: string;
}

export function AthleteExerciseCard({
  exercise,
  videos,
  athleteId,
  clubId,
}: {
  exercise: { id: string; name: string; description: string | null; focus: string | null; done: boolean };
  videos: VideoRow[];
  athleteId: string;
  clubId: string;
}) {
  const router = useRouter();
  const [done, setDone] = useState(exercise.done);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleToggle() {
    const next = !done;
    setDone(next);
    await toggleExerciseDone(exercise.id, athleteId, next);
    router.refresh();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    const { path, error: uploadError } = await uploadExerciseVideo(
      clubId,
      athleteId,
      exercise.id,
      file,
    );
    if (uploadError || !path) {
      setUploading(false);
      setError(uploadError ?? "Falha no upload.");
      return;
    }
    const result = await createExerciseVideoRecord({
      exerciseId: exercise.id,
      label: file.name,
      storagePath: path,
    });
    setUploading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Card className="mb-3">
      <div className="flex gap-3 items-start">
        <button
          type="button"
          onClick={handleToggle}
          className={`w-[22px] h-[22px] rounded-md border-2 mt-0.5 shrink-0 flex items-center justify-center ${
            done ? "bg-pitch-dark border-pitch-dark text-amber" : "border-line"
          }`}
        >
          {done ? "✓" : ""}
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <b className={`text-[14.5px] ${done ? "line-through text-ink-faint" : ""}`}>
              {exercise.name}
            </b>
            {exercise.focus && <Badge tone="sky">{exercise.focus}</Badge>}
          </div>
          <p className="text-[12.5px] text-ink-faint m-0">{exercise.description}</p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-line">
        {videos.map((v) => (
          <div key={v.id} className="flex items-center gap-3 py-2">
            <div className="w-[52px] h-[38px] rounded-md bg-[#C1432B] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
              ▶ VID
            </div>
            <div className="flex-1 min-w-0">
              <b className="text-[13px] block truncate">{v.label}</b>
              <span className="text-[11.5px] text-ink-faint">
                {v.submitted_at?.slice(0, 10)}
                {v.coach_comment ? ` · "${v.coach_comment}"` : ""}
              </span>
            </div>
            <Badge tone={v.status === "Avaliado" ? "green" : "amber"}>{v.status}</Badge>
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full border-2 border-dashed border-line rounded-md px-3.5 py-2.5 text-left flex items-center gap-2.5 text-[12.5px] hover:border-pitch-dark disabled:opacity-60"
        >
          <span className="text-lg">🎥</span>
          <span>
            <b>{uploading ? "Enviando…" : "Enviar vídeo deste exercício"}</b>
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleFile}
        />
        {error && <div className="text-clay text-[12px] font-medium mt-1.5">{error}</div>}
      </div>
    </Card>
  );
}
