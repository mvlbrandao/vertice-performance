"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { initials } from "@/lib/utils/initials";

export interface AthleteGridItem {
  id: string;
  full_name: string;
  team: string | null;
  category: string | null;
  position: string[] | null;
  instagram: string | null;
  joined_at: string | null;
  guardian_name: string | null;
  photo_color: string | null;
  signedPhotoUrl: string | null;
}

const ALL = "";

export function AthletesGrid({ athletes }: { athletes: AthleteGridItem[] }) {
  const [team, setTeam] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [position, setPosition] = useState(ALL);

  const teams = useMemo(
    () => Array.from(new Set(athletes.map((a) => a.team).filter(Boolean))).sort() as string[],
    [athletes],
  );
  const categories = useMemo(
    () => Array.from(new Set(athletes.map((a) => a.category).filter(Boolean))).sort() as string[],
    [athletes],
  );
  const positions = useMemo(
    () => Array.from(new Set(athletes.flatMap((a) => a.position ?? []))).sort(),
    [athletes],
  );

  const filtered = athletes.filter(
    (a) =>
      (!team || a.team === team) &&
      (!category || a.category === category) &&
      (!position || (a.position ?? []).includes(position)),
  );

  const hasActiveFilter = team !== ALL || category !== ALL || position !== ALL;

  return (
    <div>
      <div className="flex items-center gap-2.5 flex-wrap mb-4">
        <select
          value={team}
          onChange={(e) => setTeam(e.target.value)}
          className="px-3 py-2 border border-line rounded-sm bg-white text-[12.5px] font-semibold text-ink-soft"
        >
          <option value={ALL}>Todos os clubes</option>
          {teams.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
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
        <select
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          className="px-3 py-2 border border-line rounded-sm bg-white text-[12.5px] font-semibold text-ink-soft"
        >
          <option value={ALL}>Todas as posições</option>
          {positions.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {hasActiveFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setTeam(ALL);
              setCategory(ALL);
              setPosition(ALL);
            }}
          >
            Limpar filtros
          </Button>
        )}
        <span className="text-xs text-ink-faint ml-auto">
          {filtered.length} de {athletes.length} atleta{athletes.length === 1 ? "" : "s"}
        </span>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState icon="🔍" message="Nenhum atleta encontrado com esses filtros." />
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((a) => (
            <Link key={a.id} href={`/athletes/${a.id}/dados`}>
              <Card shadow className="h-full cursor-pointer hover:border-pitch-dark transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  {a.signedPhotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.signedPhotoUrl}
                      alt={a.full_name}
                      className="w-12 h-12 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center font-display text-lg shrink-0"
                      style={{ background: a.photo_color ?? "#111", color: "#FFD600" }}
                    >
                      {initials(a.full_name)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <b className="block text-base truncate">{a.full_name}</b>
                    <span className="text-xs text-ink-faint truncate block">
                      {a.team ?? "—"}
                      {a.instagram ? ` · ${a.instagram}` : ""}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap mb-2.5">
                  {a.category && <Badge tone="green">{a.category}</Badge>}
                  {a.position?.map((p) => (
                    <Badge key={p} tone="amber">
                      {p}
                    </Badge>
                  ))}
                </div>
                <p className="text-[12.5px] text-ink-soft m-0">
                  {a.joined_at ? `Ingressou em ${a.joined_at}` : ""}
                  {a.guardian_name ? ` · Responsável: ${a.guardian_name}` : ""}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
