// Onboarding de um novo clube: cria o clube + a primeira conta de treinador(a).
// Uso: node --env-file=.env.local scripts/create-club-coach.mjs \
//        "Nome do Clube" "Nome do Treinador" "email@exemplo.com" "senha"
//
// Fluxo assistido/manual por design (não há tela pública de signup no MVP) —
// ver Etapa 3 do plano em .claude/plans/magical-soaring-flamingo.md.

import { createClient } from "@supabase/supabase-js";

const [, , clubName, coachName, email, password] = process.argv;

if (!clubName || !coachName || !email || !password) {
  console.error(
    'Uso: node --env-file=.env.local scripts/create-club-coach.mjs "Clube" "Nome" "email" "senha"',
  );
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar em .env.local",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: club, error: clubError } = await admin
    .from("clubs")
    .insert({ name: clubName })
    .select()
    .single();
  if (clubError) throw clubError;
  console.log(`Clube criado: ${club.name} (${club.id})`);

  const { data: created, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: coachName },
  });
  if (userError) throw userError;
  console.log(`Usuário de auth criado: ${email} (${created.user.id})`);

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    club_id: club.id,
    role: "coach",
    full_name: coachName,
  });
  if (profileError) throw profileError;

  console.log("\nPronto! Login:");
  console.log(`  e-mail: ${email}`);
  console.log(`  senha:  (a que você informou)`);
  console.log(`  clube:  ${club.name} (${club.id})`);
}

main().catch((err) => {
  console.error("Falhou:", err.message ?? err);
  process.exit(1);
});
