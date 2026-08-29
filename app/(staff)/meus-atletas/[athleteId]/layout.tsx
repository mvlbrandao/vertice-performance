import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { requireStaff } from "@/lib/auth/guards";
import { getStaffAreas } from "@/lib/auth/staffAreas";
import { createClient } from "@/lib/supabase/server";
import { resolveSignedUrl } from "@/lib/storage/resolveSignedUrl";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StaffAthleteTabs } from "@/components/athletes/StaffAthleteTabs";
import { initials } from "@/lib/utils/initials";
import { computePlayerScore } from "@/lib/scoring";
import { overallColor, scoreStars } from "@/lib/utils/scoreColor";

export default async function StaffAthleteDetailLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ athleteId: string }>;
}) {
  const { athleteId } = await params;
  const profile = await requireStaff();
  const supabase = await createClient();

  // RLS ("staff reads granted athletes") já restringe a atletas liberados —
  // vazio aqui significa "não tem acesso", tratado igual a "não existe".
  const [{ data: athlete }, areas] = await Promise.all([
    supabase.from("athletes").select("*").eq("id", athleteId).maybeSingle(),
    getStaffAreas(profile.userId),
  ]);

  if (!athlete) notFound();

  const [signedPhotoUrl, score] = await Promise.all([
    resolveSignedUrl("athlete-photos", athlete.photo_url),
    computePlayerScore(supabase, athlete.id),
  ]);

  return (
    <div>
      <Card shadow className="flex gap-4.5 items-center mb-4.5 flex-wrap print:hidden">
        {signedPhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={signedPhotoUrl}
            alt={athlete.full_name}
            className="w-16 h-16 rounded-lg object-cover shrink-0"
          />
        ) : (
          <div
            className="w-16 h-16 rounded-lg flex items-center justify-center font-display text-xl shrink-0"
            style={{ background: athlete.photo_color ?? "#111", color: "#FFD600" }}
          >
            {initials(athlete.full_name)}
          </div>
        )}
        <div className="flex-1 min-w-[200px]">
          <h2 className="m-0 mb-1 font-sans text-xl font-extrabold">{athlete.full_name}</h2>
          <div className="flex gap-1.5 flex-wrap">
            {athlete.category && <Badge tone="green">{athlete.category}</Badge>}
            {athlete.position?.map((p) => (
              <Badge key={p} tone="amber">
                {p}
              </Badge>
            ))}
            {athlete.team && <Badge tone="sky">{athlete.team}</Badge>}
          </div>
        </div>
        <div className="text-center" style={{ color: overallColor(score.overall) }}>
          <span className="block text-sm leading-none">
            {"★".repeat(scoreStars(score.overall))}
            {"☆".repeat(3 - scoreStars(score.overall))}
          </span>
          <b className="font-mono text-lg block">{score.overall}</b>
          <span className="text-[11px] text-ink-faint">Score</span>
        </div>
      </Card>

      <StaffAthleteTabs athleteId={athlete.id} areas={areas} />
      {children}
    </div>
  );
}
