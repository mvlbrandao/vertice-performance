"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { reviewSubmission } from "@/lib/actions/challenges";

export function ReviewSubmissionRow({
  submissionId,
  athleteName,
  challengeTitle,
  points,
  instagramUrl,
  notes,
  submittedAt,
}: {
  submissionId: string;
  athleteName: string;
  challengeTitle: string;
  points: number;
  instagramUrl: string;
  notes: string | null;
  submittedAt: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReject, setShowReject] = useState(false);

  async function decide(decision: "Aprovado" | "Rejeitado", notesValue?: string) {
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.set("submissionId", submissionId);
    fd.set("decision", decision);
    if (notesValue) fd.set("reviewNotes", notesValue);
    const result = await reviewSubmission(fd);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleRejectSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    await decide("Rejeitado", String(formData.get("reviewNotes") ?? ""));
  }

  return (
    <div className="border border-line rounded-md p-3.5 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <b className="text-sm block">{athleteName}</b>
          <span className="text-xs text-ink-faint">
            {challengeTitle} · {new Date(submittedAt).toLocaleDateString("pt-BR")}
          </span>
        </div>
        <Badge tone="amber">+{points} pts</Badge>
      </div>
      <a
        href={instagramUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-semibold text-pitch-dark hover:underline break-all"
      >
        📸 {instagramUrl}
      </a>
      {notes && <p className="text-[12.5px] text-ink-soft m-0">{notes}</p>}
      {!showReject ? (
        <div className="flex gap-2">
          <Button variant="solid" size="sm" onClick={() => decide("Aprovado")} disabled={pending}>
            {pending ? "Aprovando…" : "Aprovar"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowReject(true)} disabled={pending}>
            Rejeitar
          </Button>
        </div>
      ) : (
        <form onSubmit={handleRejectSubmit} className="flex gap-2 items-center flex-wrap">
          <Input name="reviewNotes" placeholder="Motivo (opcional)" className="flex-1 min-w-[160px]" />
          <Button type="submit" variant="outline" size="sm" disabled={pending}>
            {pending ? "Rejeitando…" : "Confirmar rejeição"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowReject(false)}>
            Voltar
          </Button>
        </form>
      )}
      {error && <div className="text-clay text-[12px] font-medium">{error}</div>}
    </div>
  );
}
