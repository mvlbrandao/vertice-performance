/**
 * Nome do cookie que guarda o clube do link /c/<slug>.
 *
 * Fica num módulo simples, e não dentro de app/c/[slug]/route.ts, porque
 * arquivo de rota é ponto de entrada especial do Next — importá-lo de uma
 * página quebrou a hidratação da tela de login, que passou a fazer envio
 * nativo do formulário e não logava ninguém. Mesma família do problema de
 * exportar constante de arquivo "use server".
 */
export const CLUB_SLUG_COOKIE = "vertice-clube";
