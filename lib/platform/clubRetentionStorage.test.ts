import { describe, expect, it, vi } from "vitest";
import {
  CONTRACTS_BUCKET,
  isBucketMissing,
  removeClubContractFiles,
  type ContractsStorage,
} from "./clubRetentionStorage";

const CLUBE = "8f14e45f-ceea-467a-9575-0a1b2c3d4e5f";

type Entrada = { name: string; id: string | null };

/** Storage em memória: um mapa de pasta -> entradas, com paginação por offset/limit. */
function storageFalso(
  arvore: Record<string, Entrada[]>,
  opcoes: { erroNaListagem?: { message: string; status?: number }; erroNaRemocao?: boolean } = {},
) {
  const removidos: string[][] = [];
  const listados: string[] = [];
  const buckets: string[] = [];
  const storage: ContractsStorage = {
    from(bucket) {
      buckets.push(bucket);
      return {
        async list(path, options) {
          listados.push(path);
          if (opcoes.erroNaListagem) return { data: null, error: opcoes.erroNaListagem };
          const todas = arvore[path] ?? [];
          const de = options?.offset ?? 0;
          return { data: todas.slice(de, de + (options?.limit ?? 100)), error: null };
        },
        async remove(paths) {
          removidos.push(paths);
          return opcoes.erroNaRemocao
            ? { data: null, error: { message: "falha ao remover" } }
            : { data: paths, error: null };
        },
      };
    },
  };
  return { storage, removidos, listados, buckets };
}

describe("removeClubContractFiles", () => {
  it("desce as pastas e remove todos os arquivos sob {club_id}/", async () => {
    const { storage, removidos, buckets } = storageFalso({
      [CLUBE]: [
        { name: "contrato-a", id: null },
        { name: "contrato-b", id: null },
      ],
      [`${CLUBE}/contrato-a`]: [{ name: "v1.pdf", id: "1" }],
      [`${CLUBE}/contrato-b`]: [
        { name: "v1.pdf", id: "2" },
        { name: "v2.pdf", id: "3" },
      ],
    });

    const r = await removeClubContractFiles(storage, CLUBE);

    expect(r).toEqual({ removed: 3, error: null });
    expect(buckets.every((b) => b === CONTRACTS_BUCKET)).toBe(true);
    expect(removidos.flat().sort()).toEqual([
      `${CLUBE}/contrato-a/v1.pdf`,
      `${CLUBE}/contrato-b/v1.pdf`,
      `${CLUBE}/contrato-b/v2.pdf`,
    ]);
  });

  it("pagina a listagem: mais de 100 arquivos numa pasta não são esquecidos", async () => {
    const arquivos = Array.from({ length: 250 }, (_, i) => ({ name: `f${i}.pdf`, id: `id${i}` }));
    const { storage, removidos } = storageFalso({ [CLUBE]: arquivos });

    const r = await removeClubContractFiles(storage, CLUBE);

    expect(r).toEqual({ removed: 250, error: null });
    expect(removidos.flat()).toHaveLength(250);
    // Remove em lotes, não um por um nem tudo de uma vez.
    expect(removidos.map((lote) => lote.length)).toEqual([100, 100, 50]);
  });

  it("pasta vazia não é erro e não chama remove", async () => {
    const { storage, removidos } = storageFalso({});
    expect(await removeClubContractFiles(storage, CLUBE)).toEqual({ removed: 0, error: null });
    expect(removidos).toHaveLength(0);
  });

  it("bucket ausente (404) é tolerado: nada a apagar", async () => {
    const { storage } = storageFalso({}, { erroNaListagem: { message: "Bucket not found", status: 404 } });
    expect(await removeClubContractFiles(storage, CLUBE)).toEqual({ removed: 0, error: null });
  });

  it("outro erro de listagem é devolvido, sem lançar", async () => {
    const { storage } = storageFalso({}, { erroNaListagem: { message: "permission denied" } });
    const r = await removeClubContractFiles(storage, CLUBE);
    expect(r.removed).toBe(0);
    expect(r.error).toContain("permission denied");
  });

  it("falha ao remover informa quantos foram apagados e não lança", async () => {
    const { storage } = storageFalso({ [CLUBE]: [{ name: "a.pdf", id: "1" }] }, { erroNaRemocao: true });
    const r = await removeClubContractFiles(storage, CLUBE);
    expect(r.removed).toBe(0);
    expect(r.error).toContain("0 de 1 apagados");
  });

  it("id de clube vazio ou inválido NÃO lista a raiz do bucket (apagaria todos os clubes)", async () => {
    const { storage, listados } = storageFalso({ "": [{ name: "outro-clube", id: null }] });
    for (const ruim of ["", "abc", "../", `${CLUBE}/x`, undefined as unknown as string]) {
      const r = await removeClubContractFiles(storage, ruim);
      expect(r.removed).toBe(0);
      expect(r.error).toMatch(/inválido/);
    }
    expect(listados).toHaveLength(0);
  });

  it("exceção do storage vira erro devolvido", async () => {
    const storage = {
      from: () => {
        throw new Error("rede caiu");
      },
    } as unknown as ContractsStorage;
    const r = await removeClubContractFiles(storage, CLUBE);
    expect(r.error).toContain("rede caiu");
  });

  it("aborta se o clube tiver arquivos demais (teto contra laço)", async () => {
    const remover = vi.fn();
    const storage: ContractsStorage = {
      from: () => ({
        async list(_path, options) {
          const de = options?.offset ?? 0;
          return {
            data: Array.from({ length: options?.limit ?? 100 }, (_, i) => ({ name: `f${de + i}`, id: "x" })),
            error: null,
          };
        },
        remove: remover,
      }),
    };
    const r = await removeClubContractFiles(storage, CLUBE);
    expect(r.error).toMatch(/abortada/);
    expect(remover).not.toHaveBeenCalled();
  });
});

describe("isBucketMissing", () => {
  it("reconhece 404 e a mensagem do storage", () => {
    expect(isBucketMissing({ status: 404 })).toBe(true);
    expect(isBucketMissing({ statusCode: "404" })).toBe(true);
    expect(isBucketMissing({ message: "Bucket not found" })).toBe(true);
    expect(isBucketMissing({ message: "boom", status: 500 })).toBe(false);
    expect(isBucketMissing(null)).toBe(false);
  });
});
