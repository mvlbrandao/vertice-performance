import { Card } from "@/components/ui/Card";

/**
 * Uma leitura que falhou (não é migração pendente). A tela de saúde não pode
 * cair por causa de um pedaço quebrado: mostra o motivo em texto e segue.
 */
export function ReadError({ what, message }: { what: string; message: string }) {
  return (
    <Card className="border-[#D72B2B] bg-[#FDE8E8]" role="alert">
      <b className="block text-sm text-[#7A1515]">Não foi possível ler {what}</b>
      <p className="m-0 mt-1 font-mono text-xs break-words text-[#7A1515]">{message}</p>
      <p className="m-0 mt-2 text-xs text-ink-soft">Recarregue a página. Se persistir, confira as sondas acima.</p>
    </Card>
  );
}
