import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Guarda contra o defeito que derrubou a restauração diária da demo e o
 * expurgo LGPD de clube cancelado: uma tabela nova com FK SEM cascade para
 * profiles (created_by, reviewed_by...) que ninguém lembrou de acrescentar
 * em TABELAS_DO_CLUBE. Sem ela na lista, apagar o perfil do treinador
 * falha, o clube não sai e a rotina morre calada.
 *
 * Lê o SQL das migrações em vez de depender de memória humana. É heurística
 * (regex sobre "create table"), então tem uma lista curta de exceções
 * explicadas; se o teste quebrar por uma tabela nova, a resposta quase
 * sempre é acrescentá-la em lib/demo/generator.ts.
 */

// Importar o gerador carrega "server-only"; lemos só a lista, do texto.
function tabelasDaLista(): Set<string> {
  const src = readFileSync(path.join(__dirname, "generator.ts"), "utf8");
  const bloco = src.slice(src.indexOf("export const TABELAS_DO_CLUBE = ["));
  const corpo = bloco.slice(0, bloco.indexOf("] as const;"));
  return new Set([...corpo.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]));
}

const MIGRATIONS = path.join(__dirname, "..", "..", "supabase", "migrations");

/** Tabelas criadas nas migrações que têm FK para profiles/clubes/atletas sem cascade nem set null. */
function tabelasComFkSemCascade(): Set<string> {
  const achadas = new Set<string>();
  const arquivos = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();

  for (const arquivo of arquivos) {
    const sql = readFileSync(path.join(MIGRATIONS, arquivo), "utf8")
      // comentários não podem contar como código
      .replace(/--.*$/gm, "");

    for (const m of sql.matchAll(/create table\s+(?:if not exists\s+)?(?:public\.)?([a-z_]+)\s*\(/gi)) {
      const nome = m[1];
      // corpo do create table: do parêntese de abertura ao fechamento balanceado
      let i = m.index! + m[0].length;
      let nivel = 1;
      const inicio = i;
      while (i < sql.length && nivel > 0) {
        if (sql[i] === "(") nivel++;
        else if (sql[i] === ")") nivel--;
        i++;
      }
      const corpo = sql.slice(inicio, i - 1);

      for (const linha of corpo.split(/,\s*\n/)) {
        const ref = linha.match(/references\s+(?:public\.)?(profiles|clubs|athletes)\s*\(/i);
        if (!ref) continue;
        if (/on delete\s+(cascade|set null)/i.test(linha)) continue;
        achadas.add(nome);
      }
    }
  }
  return achadas;
}

/**
 * Exceções conscientes:
 * - profiles: apagada À PARTE, depois de todas as tabelas (é o que o laço faz).
 * - tabelas que mudaram a FK numa migração posterior para set null/cascade
 *   (a heurística lê só o create table e não enxerga o ALTER).
 */
const EXCECOES = new Set<string>([
  "profiles",
  "audit_log", // 0053 trocou performed_by para ON DELETE SET NULL
  "financial_audit_log", // 0053 renomeou para audit_log (já coberta acima)
  "invite_links", // 0052 limpou as FKs (set null)
]);

describe("TABELAS_DO_CLUBE", () => {
  it("cobre toda tabela com FK sem cascade para profiles, clubes ou atletas", () => {
    const lista = tabelasDaLista();
    const faltando = [...tabelasComFkSemCascade()]
      .filter((t) => !EXCECOES.has(t) && !lista.has(t))
      .sort();

    expect(
      faltando,
      `Acrescente em TABELAS_DO_CLUBE (lib/demo/generator.ts): ${faltando.join(", ")}. ` +
        "Sem isso o expurgo de clube cancelado e a restauração da demo falham.",
    ).toEqual([]);
  });

  it("sabe que announcements e athlete_enrollment_requests precisam estar na lista", () => {
    const lista = tabelasDaLista();
    expect(lista.has("announcements")).toBe(true);
    expect(lista.has("athlete_enrollment_requests")).toBe(true);
  });

  it("a rota de manutenção usa a lista do gerador, sem cópia própria", () => {
    const rota = readFileSync(
      path.join(__dirname, "..", "..", "app", "api", "cron", "club-retention", "route.ts"),
      "utf8",
    );
    expect(rota).toMatch(/import\s*\{[^}]*TABELAS_DO_CLUBE[^}]*\}\s*from\s*"@\/lib\/demo\/generator"/);
    expect(rota).not.toMatch(/const TABELAS_DO_CLUBE\s*=/);
  });
});
