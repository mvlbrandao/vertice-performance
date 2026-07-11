// Provisiona diretamente (sem passar pelo fluxo de convite por e-mail) uma
// conta de login para um atleta já existente, apenas para testes E2E locais.
import { createClient } from "@supabase/supabase-js";

const [, , athleteId, email, password] = process.argv;
if (!athleteId || !email || !password) {
  console.error(
    "Uso: node --env-file=.env.local scripts/provision-test-athlete.mjs <athleteId> <email> <senha>",
  );
  process.exit(1);
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function main() {
  const { data: athlete, error: athleteError } = await admin
    .from("athletes")
    .select("id, club_id, full_name")
    .eq("id", athleteId)
    .single();
  if (athleteError) throw athleteError;

  const { data: created, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: athlete.full_name },
  });
  if (userError) throw userError;

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    club_id: athlete.club_id,
    role: "athlete",
    full_name: athlete.full_name,
    athlete_id: athlete.id,
  });
  if (profileError) throw profileError;

  console.log("Athlete account provisioned:", email);
}

main().catch((err) => {
  console.error("Falhou:", err.message ?? err);
  process.exit(1);
});
