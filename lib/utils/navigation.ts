/**
 * Um item de menu acende no próprio caminho e em qualquer filho dele
 * (/athletes acende em /athletes/123/dados). Com `exact`, só no caminho
 * idêntico — necessário quando o href de um item é prefixo dos irmãos
 * (ex.: /admin e /admin/clubes), senão o item raiz fica marcado em tudo.
 *
 * Compara com "href + /" e não só com startsWith(href): sem a barra,
 * /athletes acenderia em /athletes-arquivados.
 */
export function isNavActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}
