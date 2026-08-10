"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { initials } from "@/lib/utils/initials";
import { overallColor, scoreStars } from "@/lib/utils/scoreColor";

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
  is_active: boolean;
  score: number;
}

const ALL = "";
const SCORE_BANDS: { value: string; label: string; test: (v: number) => boolean }[] = [
  { value: "", label: "Todos os scores", test: () => true },
  { value: "80", label: "⭐⭐⭐ 80+", test: (v) => v >= 80 },
  { value: "65", label: "⭐⭐ 65-79", test: (v) => v >= 65 && v < 80 },
  { value: "50", label: "⭐ 50-64", test: (v) => v >= 50 && v < 65 },
  { value: "0", label: "Abaixo de 50", test: (v) => v < 50 },
];
const SORT_OPTIONS = [
  { value: "name", label: "Nome (A-Z)" },
  { value: "score_desc", label: "Score (maior → menor)" },
  { value: "score_asc", label: "Score (menor → maior)" },
];

export function AthletesGrid({ athletes }: { athletes: AthleteGridItem[] }) {
  const [team, setTeam] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [position, setPosition] = useState(ALL);
  const [scoreBand, setScoreBand] = useState(ALL);
  const [sort, setSort] = useState("name");
  const [showInactive, setShowInactive] = useState(false);
  const inactiveCount = athletes.filter((a) => !a.is_active).length;

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

  const scoreTest = SCORE_BANDS.find((b) => b.value === scoreBand)?.test ?? (() => true);

  const filtered = athletes
    .filter(
      (a) =>
        (showInactive || a.is_active) &&
        (!team || a.team === team) &&
        (!category || a.category === category) &&
        (!position || (a.position ?? []).includes(position)) &&
        scoreTest(a.score),
    )
    .sort((a, b) => {
      if (sort === "score_desc") return b.score - a.score;
      if (sort === "score_asc") return a.score - b.score;
      return a.full_name.localeCompare(b.full_name);
    });

  const hasActiveFilter = team !== ALL || category !== ALL || position !== ALL || scoreBand !== ALL;

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
        <select
          value={scoreBand}
          onChange={(e) => setScoreBand(e.target.value)}
          className="px-3 py-2 border border-line rounded-sm bg-white text-[12.5px] font-semibold text-ink-soft"
        >
          {SCORE_BANDS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="px-3 py-2 border border-line rounded-sm bg-white text-[12.5px] font-semibold text-ink-soft"
        >
          {SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        {inactiveCount > 0 && (
          <label className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-soft cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Mostrar inativos ({inactiveCount})
          </label>
        )}
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
              <Card
                shadow
                className={`h-full cursor-pointer hover:border-pitch-dark transition-colors ${!a.is_active ? "opacity-60" : ""}`}
              >
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
                  <div className="min-w-0 flex-1">
                    <b className="block text-base truncate">{a.full_name}</b>
                    <span className="text-xs text-ink-faint truncate block">
                      {a.team ?? "—"}
                      {a.instagram ? ` · ${a.instagram}` : ""}
                    </span>
                  </div>
                  <div
                    className="flex flex-col items-center shrink-0"
                    style={{ color: overallColor(a.score) }}
                    title={`Score geral: ${a.score}`}
                  >
                    <span className="text-xs leading-none">
                      {"★".repeat(scoreStars(a.score))}
                      {"☆".repeat(3 - scoreStars(a.score))}
                    </span>
                    <span className="font-display text-sm leading-none mt-0.5">{a.score}</span>
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap mb-2.5">
                  {!a.is_active && <Badge tone="dark">Inativo</Badge>}
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
