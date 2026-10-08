import { redirect } from "next/navigation";

/**
 * O painel mudou para /admin. Este endereço fica só para quem o tem salvo nos
 * favoritos: não decide acesso nenhum — o /admin é quem devolve 404 a
 * estranhos e manda para o login quem não tem sessão.
 */
export default function PlataformaPage() {
  redirect("/admin");
}
