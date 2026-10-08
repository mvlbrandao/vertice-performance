/**
 * Limpeza dos arquivos de contrato de um clube expurgado (bucket privado
 * club-contracts, migração 0073). Sem "server-only" e recebendo o storage por
 * parâmetro para o teste exercitar cada ramo sem Supabase.
 *
 * Por que existe: apagar o clube leva as LINHAS por cascade, mas o PDF do
 * contrato assinado fica no storage, que nenhuma chave estrangeira alcança. O
 * expurgo de clube cancelado é uma obrigação de LGPD, e contrato guarda nome,
 * documento e endereço de quem assinou.
 *
 * Os arquivos ficam em {club_id}/{contract_id}/{arquivo}.pdf, então a listagem
 * precisa descer pastas (a API do storage lista um nível por vez).
 */
import { chunk } from "@/lib/utils/chunk";

export const CONTRACTS_BUCKET = "club-contracts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_SIZE = 100;
const REMOVE_BATCH = 100;
const MAX_DEPTH = 4;
/** Teto de segurança contra laço infinito ou bucket gigante: acima disso, devolve erro. */
const MAX_FILES = 5_000;

interface StorageErrorLike {
  message?: string;
  status?: number | string;
  statusCode?: number | string;
}
interface ListedEntry {
  name: string;
  /** Pasta vem com id nulo; arquivo, com id. */
  id: string | null;
}

/** O pedaço do storage do Supabase que interessa aqui. */
export interface ContractsStorage {
  from(bucket: string): {
    list(
      path: string,
      options?: { limit?: number; offset?: number },
    ): PromiseLike<{ data: ListedEntry[] | null; error: StorageErrorLike | null }>;
    remove(paths: string[]): PromiseLike<{ data: unknown; error: StorageErrorLike | null }>;
  };
}

export interface ContractFilesResult {
  removed: number;
  /** Mensagem de falha (a limpeza foi parcial ou não aconteceu); null = tudo certo ou nada a fazer. */
  error: string | null;
}

/** Bucket inexistente não é falha: significa que a 0073 não foi aplicada ou que não há o que apagar. */
export function isBucketMissing(error: StorageErrorLike | null | undefined): boolean {
  if (!error) return false;
  if (String(error.status ?? error.statusCode) === "404") return true;
  return /bucket not found/i.test(error.message ?? "");
}

/**
 * Remove tudo sob `{clubId}/`. Nunca lança. O `clubId` é validado como UUID:
 * um id vazio listaria a RAIZ do bucket e apagaria os contratos de todos os
 * clubes, e é exatamente o tipo de erro que uma variável indefinida causa.
 */
export async function removeClubContractFiles(
  storage: ContractsStorage,
  clubId: string,
): Promise<ContractFilesResult> {
  if (!UUID.test(clubId)) {
    return { removed: 0, error: "id de clube inválido; nenhum arquivo apagado" };
  }

  try {
    const bucket = storage.from(CONTRACTS_BUCKET);
    const files: string[] = [];
    const folders: Array<{ path: string; depth: number }> = [{ path: clubId, depth: 0 }];

    while (folders.length > 0) {
      const { path, depth } = folders.pop()!;

      for (let offset = 0; ; offset += PAGE_SIZE) {
        const { data, error } = await bucket.list(path, { limit: PAGE_SIZE, offset });
        if (error) {
          if (isBucketMissing(error)) return { removed: 0, error: null };
          return { removed: 0, error: `listar ${CONTRACTS_BUCKET}: ${error.message ?? "erro"}` };
        }
        const entries = data ?? [];

        for (const entry of entries) {
          const full = `${path}/${entry.name}`;
          if (entry.id === null) {
            if (depth < MAX_DEPTH) folders.push({ path: full, depth: depth + 1 });
          } else {
            files.push(full);
          }
        }
        if (files.length > MAX_FILES) {
          return { removed: 0, error: `mais de ${MAX_FILES} arquivos sob o clube; limpeza abortada` };
        }
        if (entries.length < PAGE_SIZE) break;
      }
    }

    if (files.length === 0) return { removed: 0, error: null };

    let removed = 0;
    for (const batch of chunk(files, REMOVE_BATCH)) {
      const { error } = await bucket.remove(batch);
      if (error) {
        return {
          removed,
          error: `remover de ${CONTRACTS_BUCKET}: ${error.message ?? "erro"} (${removed} de ${files.length} apagados)`,
        };
      }
      removed += batch.length;
    }
    return { removed, error: null };
  } catch (e) {
    return { removed: 0, error: `limpeza de ${CONTRACTS_BUCKET}: ${(e as Error)?.message ?? "erro"}` };
  }
}
