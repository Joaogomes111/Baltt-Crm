-- ============================================================================
-- Baltt CRM - transferir um lead para outra empresa (funil)
-- ----------------------------------------------------------------------------
-- Idempotente. Rode no SQL Editor da Supabase depois de crm_functions.sql.
--
-- Quem pode transferir:
--   - admin: qualquer lead para qualquer empresa;
--   - usuario empresa: apenas leads da propria empresa (para qualquer outra).
-- O lead entra no funil de destino na etapa "Novo", com o responsavel da
-- empresa de destino e uma anotacao de onde veio. Historico (telefone, origem,
-- campanha, valores, observacoes) e preservado.
-- ============================================================================

create or replace function public.transfer_crm_lead(
  p_lead_id text,
  p_company text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  user_role text;
  user_company_key text;
  target_company text := lower(trim(coalesce(p_company, '')));
  lead_item jsonb;
  lead_position integer;
  from_company text;
  from_label text;
  to_label text;
  default_service text;
  new_lead jsonb;
  today_label text := to_char(timezone('America/Sao_Paulo', now()), 'DD/MM/YYYY');
begin
  if target_company not in ('baltt', 'vale', 'baltec') then
    raise exception 'Empresa de destino invalida: %', coalesce(p_company, 'vazia');
  end if;

  select permission.role, permission.company_key
  into user_role, user_company_key
  from public.crm_permission_for_current_user() permission;

  if user_role is null then
    raise exception 'Usuario sem permissao no CRM.';
  end if;

  -- Trava a linha para nao concorrer com salvamentos/webhooks.
  perform 1 from public.crm_snapshots where id = 'main' for update;

  select item.value, item.ordinality
  into lead_item, lead_position
  from public.crm_snapshots snapshot
  cross join jsonb_array_elements(coalesce(snapshot.leads, '[]'::jsonb)) with ordinality as item(value, ordinality)
  where snapshot.id = 'main'
    and item.value ->> 'id' = p_lead_id
  order by item.ordinality
  limit 1;

  if lead_item is null then
    raise exception 'Lead nao encontrado na base.';
  end if;

  from_company := lead_item ->> 'company';

  if from_company = target_company then
    raise exception 'O lead ja esta no funil desta empresa.';
  end if;

  if user_role <> 'admin' and from_company is distinct from user_company_key then
    raise exception 'Usuario so pode transferir leads da propria empresa.';
  end if;

  from_label := case from_company when 'baltt' then 'Baltt' when 'vale' then 'Vale' when 'baltec' then 'Baltec' else coalesce(from_company, '?') end;
  to_label := case target_company when 'baltt' then 'Baltt' when 'vale' then 'Vale' else 'Baltec' end;
  default_service := case target_company
    when 'baltt' then 'Terraplanagem'
    when 'vale' then 'Britas / Agregados'
    else 'Pavers / Blocos'
  end;

  new_lead := lead_item || jsonb_build_object(
    'company', target_company,
    'stage', 'novo',
    'leadStatus', 'Novo',
    'closeDate', '',
    'lossReason', '',
    'owner', 'Comercial ' || to_label,
    -- Se o servico era o padrao da empresa de origem (ou vazio), troca pelo padrao do destino.
    'service', case
      when coalesce(lead_item ->> 'service', '') in ('', 'Terraplanagem', 'Britas / Agregados', 'Pavers / Blocos')
        then default_service
      else lead_item ->> 'service'
    end,
    'notes', trim(both ' |' from
      coalesce(lead_item ->> 'notes', '') || ' | ' ||
      'Transferido de ' || from_label || ' para ' || to_label || ' em ' || today_label
    ),
    'lastUpdate', 'Transferido de ' || from_label || ' em ' || today_label,
    'transferredFrom', from_company,
    'transferredAt', to_char(timezone('America/Sao_Paulo', now()), 'YYYY-MM-DD')
  );

  update public.crm_snapshots
  set leads = jsonb_set(leads, array[(lead_position - 1)::text], new_lead, false),
      updated_at = now()
  where id = 'main';

  return public.load_crm_snapshot_for_user();
end;
$$;

revoke all on function public.transfer_crm_lead(text, text) from public, anon;
grant execute on function public.transfer_crm_lead(text, text) to authenticated;
