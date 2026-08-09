import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { resolveSignedUrl } from "@/lib/storage/resolveSignedUrl";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AthleteTabs } from "@/components/athletes/AthleteTabs";
import { AthletePhotoUploader } from "@/components/athletes/AthletePhotoUploader";

export default async function AthleteDetailLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ athleteId: string }>;
}) {
  const { athleteId } = await params;
  const profile = await getSessionProfile();
  const supabase = await createClient();

  const { data: athlete } = await supabase
    .from("athletes")
    .select("*")
    .eq("id", athleteId)
    .eq("club_id", profile!.clubId)
    .single();

  if (!athlete) notFound();

  const signedPhotoUrl = await resolveSignedUrl("athlete-photos", athlete.photo_url);

  return (
    <div>
      <Card shadow className="flex gap-4.5 items-center mb-4.5 flex-wrap">
        <AthletePhotoUploader
          athleteId={athlete.id}
          clubId={athlete.club_id}
          fullName={athlete.full_name}
          photoColor={athlete.photo_color}
          signedPhotoUrl={signedPhotoUrl}
        />
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
            {athlete.instagram && <Badge tone="dark">📸 {athlete.instagram}</Badge>}
          </div>
        </div>
        <div className="flex gap-6.5 text-center">
          <div>
            <b className="font-mono text-lg block">
              {athlete.height_cm ? `${athlete.height_cm}cm` : "—"}
            </b>
            <span className="text-[11px] text-ink-faint">Altura</span>
          </div>
          <div>
            <b className="font-mono text-lg block">
              {athlete.weight_kg ? `${athlete.weight_kg}kg` : "—"}
            </b>
            <span className="text-[11px] text-ink-faint">Peso</span>
          </div>
          <div>
            <b className="font-mono text-lg block">{athlete.bmi ?? "—"}</b>
            <span className="text-[11px] text-ink-faint">IMC</span>
          </div>
        </div>
      </Card>

      <AthleteTabs athleteId={athlete.id} />
      {children}
    </div>
  );
}
