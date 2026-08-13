// Dispara a restauração do clube de demonstração pela mesma rota que o
// agendamento diário usa — assim existe uma implementação só, em
// lib/demo/generator.ts, e o que roda na sua máquina é o que roda em
// produção.
//
// Uso (com o servidor no ar):
//   node scripts/seed-demo-club.mjs                    # local
//   node scripts/seed-demo-club.mjs https://seu.app     # outro ambiente
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const base = process.argv[2] ?? "http://localhost:3000";
const res = await fetch(`${base}/api/cron/club-retention`, {
  headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
});
const body = await res.json().catch(() => null);
console.log(res.status, JSON.stringify(body, null, 2));
process.exit(res.ok ? 0 : 1);
