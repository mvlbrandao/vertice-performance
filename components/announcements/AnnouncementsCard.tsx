"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { markAnnouncementRead } from "@/lib/actions/announcements";
import type { VisibleAnnouncement } from "@/lib/data/announcements";

export function AnnouncementsCard({ announcements }: { announcements: VisibleAnnouncement[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (announcements.length === 0) return null;

  async function handleMarkRead(id: string) {
    setPendingId(id);
    await markAnnouncementRead(id);
    setPendingId(null);
    router.refresh();
  }

  return (
    <Card className="mb-4">
      <h3 className="mt-0 mb-3">📣 Avisos</h3>
      <div className="flex flex-col gap-2.5">
        {announcements.map((a) => (
          <div
            key={a.id}
            className={`border-l-[3px] pl-3 py-0.5 ${
              a.read ? "border-l-line" : "border-l-amber"
            }`}
          >
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <b className="text-[13.5px]">{a.title}</b>
              {!a.read && <Badge tone="amber">Novo</Badge>}
            </div>
            <p className="text-[12.5px] text-ink-soft m-0 whitespace-pre-wrap">{a.body}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-xs text-ink-faint">
                {new Date(a.created_at).toLocaleDateString("pt-BR")}
              </span>
              {!a.read && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleMarkRead(a.id)}
                  disabled={pendingId === a.id}
                >
                  {pendingId === a.id ? "…" : "Marcar como lido"}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
