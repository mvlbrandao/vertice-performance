-- Kanban de planejamento (comissão técnica): evolução de cada atleta por
-- sub, colunas editáveis por clube. Sem tabela de histórico de propósito —
-- "há quantos dias nessa etapa" só precisa do moved_at da posição atual, e
-- acoplar isso no audit_log (que tem entity_type/action em check fechado,
-- pensado pra financeiro) custaria mais do que vale agora.

create table planning_columns (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  name text not null,
  position int not null,
  color text not null default 'sky',
  created_at timestamptz not null default now()
);

create index on planning_columns (club_id);

create table athlete_planning_stage (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references clubs(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete cascade,
  column_id uuid references planning_columns(id) on delete set null,
  note text,
  moved_at timestamptz not null default now(),
  unique (athlete_id)
);

create index on athlete_planning_stage (club_id);

alter table planning_columns enable row level security;
alter table athlete_planning_stage enable row level security;

-- Coach-only: comissão técnica hoje não tem staff nenhum alcançando ela
-- (route group (coach) já barra staff/atleta antes de chegar aqui), mesma
-- regra que planejamento segue.
create policy "coach manages planning columns" on planning_columns for all
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');

create policy "coach manages planning stage" on athlete_planning_stage for all
  using (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach')
  with check (club_id = (select club_id from my_profile()) and (select role from my_profile()) = 'coach');

-- Backfill: todo clube existente (inclusive a demo) ganha as 5 colunas
-- padrão. Mantidas em sincronia manualmente com lib/data/planningDefaults.ts
-- (cadastro público e geração da demo inserem a mesma lista pra clube novo).
insert into planning_columns (club_id, name, position, color)
select c.id, v.name, v.position, v.color
from clubs c
cross join (values
  ('Diagnóstico', 0, 'dark'),
  ('Plano definido', 1, 'sky'),
  ('Em desenvolvimento', 2, 'amber'),
  ('Em validação', 3, 'clay'),
  ('Consolidado', 4, 'green')
) as v(name, position, color);
