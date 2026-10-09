-- Ativar um contrato (rascunho -> vigente), trocando o vigente do clube numa
-- transação só.
--
-- Antes isso eram duas gravações separadas feitas pelo painel: encerrar o
-- vigente antigo e ativar o novo. O PostgREST não tem transação entre
-- chamadas, então uma falha entre as duas deixava o clube SEM contrato
-- vigente (ou, pior, com o motivo "Substituído pelo CT-n" gravado num
-- contrato que ninguém substituiu). Aqui as duas mudanças acontecem juntas ou
-- nenhuma acontece: qualquer erro desfaz tudo.
--
-- Corrida: duas ativações simultâneas no mesmo clube são serializadas por um
-- lock de aconselhamento por clube, então a segunda enxerga o resultado da
-- primeira (e recebe has_active) em vez de bater no índice único parcial
-- club_contracts_one_active_per_club. O índice continua sendo a trava final.
--
-- Devolve jsonb com ok e, quando não deu certo, um código:
--   not_found  contrato inexistente
--   not_draft  só rascunho pode ser ativado
--   has_active já há vigente e o chamador não confirmou a substituição
--
-- Só a service role executa (mesma regra das demais funções platform_*, 0050).
create function public.platform_activate_contract(
  p_contract_id uuid,
  p_replace boolean default false,
  p_closed_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_new public.club_contracts%rowtype;
  v_old public.club_contracts%rowtype;
begin
  select * into v_new from public.club_contracts where id = p_contract_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;

  -- Serializa por clube ANTES de reler o estado: sem isso duas chamadas
  -- veriam "sem vigente" ao mesmo tempo.
  perform pg_advisory_xact_lock(hashtextextended(v_new.club_id::text, 0));

  select * into v_new from public.club_contracts where id = p_contract_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if v_new.status <> 'rascunho' then
    return jsonb_build_object('ok', false, 'code', 'not_draft', 'status', v_new.status);
  end if;

  select * into v_old
  from public.club_contracts
  where club_id = v_new.club_id and status = 'vigente'
  for update;

  if found then
    if not p_replace then
      return jsonb_build_object(
        'ok', false, 'code', 'has_active',
        'active_id', v_old.id, 'active_number', v_old.number
      );
    end if;

    update public.club_contracts
    set status = 'encerrado',
        closed_at = now(),
        closed_reason = coalesce(nullif(trim(p_closed_reason), ''), 'Substituído pelo CT-' || v_new.number),
        updated_at = now()
    where id = v_old.id;
  end if;

  update public.club_contracts
  set status = 'vigente', updated_at = now()
  where id = v_new.id;

  return jsonb_build_object(
    'ok', true,
    'club_id', v_new.club_id,
    'number', v_new.number,
    'replaced_id', v_old.id,
    'replaced_number', v_old.number
  );
end;
$$;

revoke execute on function public.platform_activate_contract(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.platform_activate_contract(uuid, boolean, text) to service_role;
