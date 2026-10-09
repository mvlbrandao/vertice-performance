import { Card } from "@/components/ui/Card";

/** Estado vazio com uma linha de explicação (as seções de coleta recente dizem por que ainda não há dado). */
export function EmptyNote({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <Card>
      <div className="text-center py-8 px-3 text-ink-faint">
        <div className="text-3xl mb-2">{icon}</div>
        <div>{title}</div>
        {hint && <p className="text-xs mt-2 mb-0 max-w-md mx-auto">{hint}</p>}
      </div>
    </Card>
  );
}
