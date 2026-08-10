import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { StaffAccessModal } from "@/components/staff/StaffAccessModal";
import { StaffProfileTabs } from "@/components/staff/StaffProfileTabs";
import { ExpenseRow } from "@/components/expenses/ExpenseRow";

function formatCents(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default async function StaffProfilePage({
  params,
}: {
  params: Promise<{ staffId: string }>;
}) {
  const { staffId } = await params;
  const profile = await getSessionProfile();
  const supabase = await createClient();
  const today = todayISO();

  const { data: staff } = await supabase
    .from("profiles")
    .select("id, full_name, title, staff_areas")
    .eq("id", staffId)
    .eq("club_id", profile!.clubId)
    .eq("role", "staff")
    .single();

  if (!staff) notFound();

  const [{ data: athletes }, { data: grants }, { data: categories }, { data: professionals }, { data: expenses }] =
    await Promise.all([
      supabase
        .from("athletes")
        .select("id, full_name")
        .eq("club_id", profile!.clubId)
        .order("full_name", { ascending: true }),
      supabase
        .from("athlete_staff_access")
        .select("athlete_id, access_level")
        .eq("club_id", profile!.clubId)
        .eq("staff_profile_id", staffId),
      supabase
        .from("expense_categories")
        .select("id, name, requires_professional")
        .eq("club_id", profile!.clubId)
        .order("name", { ascending: true }),
      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("club_id", profile!.clubId)
        .eq("role", "staff")
        .order("full_name", { ascending: true }),
      supabase
        .from("expenses")
        .select("id, description, amount_cents, due_date, status, category_id, notes, expense_categories(name)")
        .eq("club_id", profile!.clubId)
        .eq("professional_id", staffId)
        .order("due_date", { ascending: false }),
    ]);

  const categoryOptions = (categories ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    requiresProfessional: c.requires_professional,
  }));
  const grantedList = (grants ?? []).map((g) => ({
    athleteId: g.athlete_id,
    accessLevel: g.access_level,
  }));

  const rows = expenses ?? [];
  const isOverdue = (e: { status: string; due_date: string }) =>
    e.status === "Atrasado" || (e.status === "Pendente" && e.due_date < today);
  const paidTotal = rows
    .filter((e) => e.status === "Pago")
    .reduce((sum, e) => sum + e.amount_cents, 0);
  const pendingTotal = rows
    .filter((e) => e.status === "Pendente" || e.status === "Atrasado")
    .reduce((sum, e) => sum + e.amount_cents, 0);
  const overdueTotal = rows.filter(isOverdue).reduce((sum, e) => sum + e.amount_cents, 0);

  return (
    <div>
      <div className="mb-4">
        <Link href="/equipe" className="text-xs font-semibold text-ink-faint hover:underline">
          ← Equipe
        </Link>
        <h1 className="text-[28px] m-0 mt-1">{staff.full_name}</h1>
        <div className="text-xs text-ink-faint mt-0.5">{staff.title ?? "Staff"}</div>
      </div>

      <StaffProfileTabs
        dados={
          <Card className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <b className="text-sm block">{staff.full_name}</b>
              <span className="text-xs text-ink-faint">
                {staff.title ?? "Staff"} · {grantedList.length} atleta
                {grantedList.length === 1 ? "" : "s"} liberado{grantedList.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={grantedList.length > 0 ? "green" : "amber"}>
                {grantedList.length > 0 ? "Com acesso" : "Sem acesso ainda"}
              </Badge>
              <StaffAccessModal
                staffProfileId={staff.id}
                staffName={staff.full_name}
                athletes={athletes ?? []}
                grants={grantedList}
                areas={staff.staff_areas ?? []}
              />
            </div>
          </Card>
        }
        recebimentos={
          <div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
              <Card>
                <span className="text-xs font-semibold text-ink-soft">Recebido</span>
                <b className="block font-display text-2xl leading-none mt-1">
                  {formatCents(paidTotal)}
                </b>
              </Card>
              <Card>
                <span className="text-xs font-semibold text-ink-soft">A receber</span>
                <b className="block font-display text-2xl leading-none mt-1">
                  {formatCents(pendingTotal)}
                </b>
              </Card>
              <Card>
                <span className="text-xs font-semibold text-ink-soft">Atrasado</span>
                <b className="block font-display text-2xl leading-none mt-1 text-clay">
                  {formatCents(overdueTotal)}
                </b>
              </Card>
            </div>
            <Card>
              {rows.length === 0 ? (
                <EmptyState icon="💰" message="Nenhum recebimento lançado ainda." />
              ) : (
                rows.map((e) => (
                  <ExpenseRow
                    key={e.id}
                    id={e.id}
                    description={e.description}
                    categoryId={e.category_id}
                    categoryName={
                      (e.expense_categories as unknown as { name: string } | null)?.name ?? null
                    }
                    categories={categoryOptions}
                    professionalId={staff.id}
                    professionalName={staff.full_name}
                    professionals={professionals ?? []}
                    amountCents={e.amount_cents}
                    notes={e.notes}
                    dueDate={e.due_date}
                    status={e.status}
                  />
                ))
              )}
            </Card>
          </div>
        }
      />
    </div>
  );
}
