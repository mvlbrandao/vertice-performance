import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { InviteStaffModal } from "@/components/staff/InviteStaffModal";
import { StaffAccessModal } from "@/components/staff/StaffAccessModal";

export default async function EquipePage() {
  const profile = await getSessionProfile();
  const supabase = await createClient();

  const [{ data: staffProfiles }, { data: athletes }, { data: grants }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, title")
      .eq("club_id", profile!.clubId)
      .eq("role", "staff")
      .order("full_name", { ascending: true }),
    supabase
      .from("athletes")
      .select("id, full_name")
      .eq("club_id", profile!.clubId)
      .order("full_name", { ascending: true }),
    supabase
      .from("athlete_staff_access")
      .select("athlete_id, staff_profile_id, access_level")
      .eq("club_id", profile!.clubId),
  ]);

  const grantedByStaff = new Map<string, { athleteId: string; accessLevel: "view" | "manage" }[]>();
  for (const g of grants ?? []) {
    const list = grantedByStaff.get(g.staff_profile_id) ?? [];
    list.push({ athleteId: g.athlete_id, accessLevel: g.access_level });
    grantedByStaff.set(g.staff_profile_id, list);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="text-xs text-ink-faint uppercase tracking-wide mb-0.5">
            Segurança & privacidade
          </div>
          <h1 className="text-[28px] m-0">Equipe</h1>
          <div className="text-xs text-ink-faint mt-1 max-w-2xl">
            Profissionais externos ao clube (treinador de específicos, preparador físico etc.)
            acessam só os atletas que você liberar — nunca o clube inteiro.
          </div>
        </div>
        <InviteStaffModal />
      </div>

      {!staffProfiles || staffProfiles.length === 0 ? (
        <Card>
          <EmptyState icon="🧑‍⚕️" message="Nenhum profissional convidado ainda." />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {staffProfiles.map((s) => {
            const grantedList = grantedByStaff.get(s.id) ?? [];
            return (
              <Card key={s.id} className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <b className="text-sm block">{s.full_name}</b>
                  <span className="text-xs text-ink-faint">
                    {s.title ?? "Staff"} · {grantedList.length} atleta
                    {grantedList.length === 1 ? "" : "s"} liberado
                    {grantedList.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={grantedList.length > 0 ? "green" : "amber"}>
                    {grantedList.length > 0 ? "Com acesso" : "Sem acesso ainda"}
                  </Badge>
                  <StaffAccessModal
                    staffProfileId={s.id}
                    staffName={s.full_name}
                    athletes={athletes ?? []}
                    grants={grantedList}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
