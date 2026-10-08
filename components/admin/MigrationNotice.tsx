import { Card } from "@/components/ui/Card";

/**
 * Aviso de migração ainda não aplicada. O código sobe antes do SQL em
 * produção; sem isto a tela cairia em erro 500 em vez de dizer o que falta.
 */
export function MigrationNotice({
  migration,
  what,
}: {
  /** Número da migração, ex.: "0072". */
  migration: string;
  /** O que fica indisponível enquanto isso, em uma frase. */
  what: string;
}) {
  return (
    <Card className="border-amber bg-[#FFFBE6]">
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none" aria-hidden="true">
          ⚠️
        </span>
        <div className="min-w-0">
          <b className="block text-sm">Migração {migration} pendente</b>
          <p className="text-[13px] text-ink-soft mt-1 mb-0">
            {what} Aplique <code className="font-mono text-xs">supabase/migrations/{migration}_*.sql</code>{" "}
            no banco para liberar. Enquanto isso, nada quebra: esta tela só avisa.
          </p>
        </div>
      </div>
    </Card>
  );
}
