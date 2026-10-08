import { redirect } from "next/navigation";
import { getSessionProfile, roleHomePath } from "@/lib/auth/session";
import { getPlatformAdmin } from "@/lib/platform/admin";

export default async function Home() {
  // Antes do perfil de clube: o dono da plataforma pode nem ter um, e sem
  // esta checagem ficaria preso no login. Quem é administrador e também
  // treinador entra por /admin e volta ao clube pelo menu ("Meu clube").
  if (await getPlatformAdmin()) redirect("/admin");

  const profile = await getSessionProfile();

  if (!profile) redirect("/login");
  redirect(roleHomePath(profile.role));
}
