-- Telemetria técnica da plataforma: erros do servidor, desempenho medido no
-- navegador de quem usa e execução dos jobs agendados.
--
-- Fica no nosso banco, e não só num serviço externo, por dois motivos: o
-- painel de admin precisa mostrar "o sistema está bem?" sem exigir login em
-- outra ferramenta, e o plano atual não tem retenção longa de log.
--
-- Nada aqui guarda dado pessoal. Mensagens de erro são truncadas e tiradas
-- de e-mails/UUIDs antes de gravar (lib/observability), rotas são gravadas
-- normalizadas ("/athletes/:id/dados"), e não há id de usuário — só o clube,
-- para saber se o problema é de um cliente ou de todos.
--
-- Todas as tabelas: somente service role. Retenção por platform_prune_telemetry,
-- chamada pelo cron diário já existente (club-retention).

-- ---------------------------------------------------------------------------
-- Erros e eventos de falha
-- ---------------------------------------------------------------------------
create table system_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  severity text not null default 'error' check (severity in ('warn', 'error')),
  source text not null check (source in ('render', 'route', 'action', 'proxy', 'cron', 'webhook')),
  -- Rota normalizada (ids viram :id), nunca a URL crua: query string pode
  -- carregar token.
  route text not null,
  method text,
  status_code integer,
  duration_ms integer,
  message text not null,
  -- digest do Next: permite achar a mesma falha no log da Vercel.
  digest text,
  -- Hash de source+route+mensagem normalizada: agrupa mil ocorrências da
  -- mesma falha numa linha só.
  fingerprint text not null,
  club_id uuid
);

create index system_events_occurred_idx on system_events (occurred_at desc);
create index system_events_fingerprint_idx on system_events (fingerprint, occurred_at desc);

-- ---------------------------------------------------------------------------
-- Web Vitals medidos no navegador real (RUM)
-- ---------------------------------------------------------------------------
create table web_vitals (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  route text not null,
  metric text not null check (metric in ('LCP', 'INP', 'CLS', 'TTFB', 'FCP')),
  value double precision not null check (value >= 0),
  rating text not null check (rating in ('good', 'needs-improvement', 'poor')),
  nav_type text,
  device text not null check (device in ('mobile', 'desktop')),
  club_id uuid
);

create index web_vitals_occurred_idx on web_vitals (occurred_at desc);
create index web_vitals_route_metric_idx on web_vitals (route, metric, occurred_at desc);

-- ---------------------------------------------------------------------------
-- Execução dos jobs agendados
-- ---------------------------------------------------------------------------
create table cron_runs (
  id bigint generated always as identity primary key,
  job text not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  ok boolean,
  duration_ms integer,
  summary jsonb not null default '{}'::jsonb,
  error text
);

create index cron_runs_job_idx on cron_runs (job, started_at desc);

alter table system_events enable row level security;
alter table web_vitals enable row level security;
alter table cron_runs enable row level security;
revoke all on system_events, web_vitals, cron_runs from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Agregações. SQL e não código de aplicação: o PostgREST corta respostas em
-- 1000 linhas, então somar/agrupar no servidor Node truncaria em silêncio
-- justamente quando houver muito erro — o pior momento para o número mentir.
-- Todas são SECURITY INVOKER e só a service role executa (nada de
-- /rest/v1/rpc aberto para anon/authenticated).
-- ---------------------------------------------------------------------------
create function public.platform_error_groups(p_since timestamptz)
returns table (
  fingerprint text,
  source text,
  route text,
  severity text,
  occurrences bigint,
  clubs_affected bigint,
  first_seen timestamptz,
  last_seen timestamptz,
  sample_message text,
  sample_digest text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    e.fingerprint,
    (array_agg(e.source order by e.occurred_at desc))[1],
    (array_agg(e.route order by e.occurred_at desc))[1],
    (array_agg(e.severity order by e.occurred_at desc))[1],
    count(*),
    count(distinct e.club_id),
    min(e.occurred_at),
    max(e.occurred_at),
    (array_agg(e.message order by e.occurred_at desc))[1],
    (array_agg(e.digest order by e.occurred_at desc))[1]
  from public.system_events e
  where e.occurred_at >= p_since
  group by e.fingerprint
  order by max(e.occurred_at) desc
  limit 200
$$;

create function public.platform_error_daily(p_days integer)
returns table (day date, errors bigint, warnings bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (e.occurred_at at time zone 'America/Sao_Paulo')::date,
    count(*) filter (where e.severity = 'error'),
    count(*) filter (where e.severity = 'warn')
  from public.system_events e
  where e.occurred_at >= now() - make_interval(days => p_days)
  group by 1
  order by 1
$$;

create function public.platform_vitals_summary(p_since timestamptz)
returns table (
  route text,
  metric text,
  device text,
  samples bigint,
  p50 double precision,
  p75 double precision,
  p95 double precision,
  poor_pct numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    v.route,
    v.metric,
    v.device,
    count(*),
    percentile_cont(0.5) within group (order by v.value),
    percentile_cont(0.75) within group (order by v.value),
    percentile_cont(0.95) within group (order by v.value),
    round(100.0 * count(*) filter (where v.rating = 'poor') / count(*), 1)
  from public.web_vitals v
  where v.occurred_at >= p_since
  group by v.route, v.metric, v.device
  order by count(*) desc
  limit 500
$$;

create function public.platform_prune_telemetry(p_keep_days integer default 30)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cut timestamptz := now() - make_interval(days => greatest(p_keep_days, 1));
  v_events bigint;
  v_vitals bigint;
  v_cron bigint;
begin
  delete from public.system_events where occurred_at < v_cut;
  get diagnostics v_events = row_count;
  delete from public.web_vitals where occurred_at < v_cut;
  get diagnostics v_vitals = row_count;
  delete from public.cron_runs where started_at < v_cut;
  get diagnostics v_cron = row_count;
  return jsonb_build_object('system_events', v_events, 'web_vitals', v_vitals, 'cron_runs', v_cron);
end;
$$;

-- No PostgreSQL toda função nasce com EXECUTE para PUBLIC (e anon herda).
-- Revoga de PUBLIC e devolve só à service role — mesma lição da 0050.
revoke execute on function public.platform_error_groups(timestamptz) from public, anon, authenticated;
revoke execute on function public.platform_error_daily(integer) from public, anon, authenticated;
revoke execute on function public.platform_vitals_summary(timestamptz) from public, anon, authenticated;
revoke execute on function public.platform_prune_telemetry(integer) from public, anon, authenticated;
grant execute on function public.platform_error_groups(timestamptz) to service_role;
grant execute on function public.platform_error_daily(integer) to service_role;
grant execute on function public.platform_vitals_summary(timestamptz) to service_role;
grant execute on function public.platform_prune_telemetry(integer) to service_role;
