-- Uso de cada clube, numa consulta só, para o painel de admin.
--
-- Antes o painel baixava TODAS as linhas de atletas ativos só para contar
-- por clube (select club_id from athletes) e pedia listUsers(perPage: 1000)
-- para achar último acesso. Os dois quebram em silêncio: o PostgREST corta
-- em 1000 linhas e a contagem passa a ficar errada sem nenhum erro. Contar
-- no banco não tem esse limite.
--
-- SECURITY DEFINER porque lê auth.users (último acesso), que a API não
-- expõe. Por isso EXECUTE é revogado de todo mundo e devolvido só à service
-- role — o linter de segurança não deve achar esta função chamável por
-- anon/authenticated.
create function public.platform_club_usage()
returns table (
  club_id uuid,
  athletes_active bigint,
  athletes_total bigint,
  coaches bigint,
  staff bigint,
  athlete_logins bigint,
  last_sign_in_at timestamptz,
  last_audit_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    (select count(*) from public.athletes a where a.club_id = c.id and a.is_active),
    (select count(*) from public.athletes a where a.club_id = c.id),
    (select count(*) from public.profiles p where p.club_id = c.id and p.role = 'coach'),
    (select count(*) from public.profiles p where p.club_id = c.id and p.role = 'staff'),
    (select count(*) from public.profiles p where p.club_id = c.id and p.role = 'athlete'),
    (
      select max(u.last_sign_in_at)
      from public.profiles p
      join auth.users u on u.id = p.id
      where p.club_id = c.id
    ),
    (select max(l.performed_at) from public.audit_log l where l.club_id = c.id)
  from public.clubs c
$$;

revoke execute on function public.platform_club_usage() from public, anon, authenticated;
grant execute on function public.platform_club_usage() to service_role;
