import { Card } from "@/components/ui/Card";

/**
 * Aviso permanente enquanto a função platform_prune_telemetry não existe no
 * banco: sem ela a telemetria nunca é apagada e as tabelas só crescem.
 * Vem do resumo do último expurgo (cron_runs.summary.retencao = "pendente").
 */
export function RetentionNotice() {
  return (
    <Card className="mb-5 border-amber bg-[#FFFBE6]" role="status">
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none" aria-hidden="true">
          ⚠️
        </span>
        <div className="min-w-0">
          <b className="block text-sm">
            Retenção da telemetria pendente: aplique <code className="font-mono text-xs">platform_prune_telemetry</code>{" "}
            (docs/ADMIN.md)
          </b>
          <p className="text-[13px] text-ink-soft mt-1 mb-0">
            Enquanto a função não existir no banco, erros, Web Vitals e execuções de rotinas não são apagados após 30
            dias. Nada quebra; as tabelas só crescem.
          </p>
        </div>
      </div>
    </Card>
  );
}
