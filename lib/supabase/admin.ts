import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

/**
 * Client com service_role — ignora RLS por completo. Uso restrito a fluxos
 * privilegiados server-only (provisionamento de contas). NUNCA importar a
 * partir de um componente client nem de código que rode no browser.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Falta de configuração precisa gritar. Com os `!` de antes, a chave
  // ausente virava a string "undefined", o Supabase respondia 401 e cada
  // chamador — que descarta o erro — mostrava "não encontrado". O sistema
  // ficava todo verde, dizendo que convite e clube não existiam.
  //
  // Erra aqui, na chamada, e não na importação: lançar no topo do módulo
  // derruba o `next build` inteiro em quem não tem a variável.
  if (!url || !key) {
    throw new Error(
      "[supabase] NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente no ambiente do servidor.",
    );
  }

  return createSupabaseClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
