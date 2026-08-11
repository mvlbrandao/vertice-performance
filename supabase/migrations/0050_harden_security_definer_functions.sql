-- Reduz a superfície exposta pela API REST do Supabase (achado do linter de
-- segurança: funções SECURITY DEFINER chamáveis via /rest/v1/rpc).
--
-- Atenção ao detalhe que faz essa migration existir: no PostgreSQL toda
-- função nasce com EXECUTE concedido ao papel PUBLIC, e `anon` herda dele.
-- Revogar só de `anon`/`authenticated` não surte efeito nenhum — é preciso
-- revogar de PUBLIC e devolver explicitamente a quem precisa.

-- Funções de gatilho: ninguém precisa de EXECUTE. O PostgreSQL não checa
-- essa permissão ao disparar um trigger, então elas seguem funcionando
-- normalmente (validado marcando exercício como feito e vendo o progresso
-- do SWOT incrementar).
revoke execute on function public.guard_athlete_confirm_only() from public, anon, authenticated;
revoke execute on function public.guard_athlete_done_only() from public, anon, authenticated;
revoke execute on function public.increment_swot_progress() from public, anon, authenticated;

-- Funções auxiliares usadas dentro das políticas de RLS: quem está logado
-- PRECISA poder executar (a política é avaliada com a permissão de quem
-- consulta — revogar de `authenticated` derrubaria o acesso do app inteiro).
-- Visitante anônimo não tem motivo pra chamá-las: auth.uid() é nulo e elas
-- só retornariam vazio/false.
revoke execute on function public.my_profile() from public, anon;
revoke execute on function public.has_athlete_access(uuid) from public, anon;
revoke execute on function public.has_athlete_manage_access(uuid) from public, anon;
revoke execute on function public.has_staff_area(text) from public, anon;

grant execute on function public.my_profile() to authenticated;
grant execute on function public.has_athlete_access(uuid) to authenticated;
grant execute on function public.has_athlete_manage_access(uuid) to authenticated;
grant execute on function public.has_staff_area(text) to authenticated;
