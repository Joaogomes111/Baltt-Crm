create extension if not exists pgcrypto;

create table if not exists crm_snapshots (
  id text primary key default 'main' check (id = 'main'),
  leads jsonb not null default '[]'::jsonb,
  investments jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table crm_snapshots enable row level security;

create table if not exists crm_user_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null unique,
  role text not null default 'empresa' check (role in ('admin', 'empresa')),
  company_key text check (company_key is null or company_key in ('baltt', 'vale', 'baltec')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (role = 'admin' or company_key is not null)
);

alter table crm_user_permissions enable row level security;

create or replace function public.crm_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.crm_user_permissions permission
    where permission.role = 'admin'
      and (
        permission.user_id = auth.uid()
        or lower(permission.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  );
$$;

create or replace function public.crm_permission_for_current_user()
returns table (
  role text,
  company_key text,
  email text
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    permission.role,
    permission.company_key,
    permission.email
  from public.crm_user_permissions permission
  where permission.user_id = auth.uid()
    or lower(permission.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  order by case when permission.user_id = auth.uid() then 0 else 1 end
  limit 1;
$$;

drop policy if exists "authenticated users can read crm snapshots" on crm_snapshots;
drop policy if exists "authenticated users can insert crm snapshots" on crm_snapshots;
drop policy if exists "authenticated users can update crm snapshots" on crm_snapshots;
drop policy if exists "crm admins can read crm snapshots" on crm_snapshots;
drop policy if exists "crm admins can insert crm snapshots" on crm_snapshots;
drop policy if exists "crm admins can update crm snapshots" on crm_snapshots;
drop policy if exists "users can read own crm permission" on crm_user_permissions;
drop policy if exists "admins can manage crm permissions" on crm_user_permissions;

create policy "crm admins can read crm snapshots"
  on crm_snapshots for select
  to authenticated
  using (public.crm_user_is_admin());

create policy "crm admins can insert crm snapshots"
  on crm_snapshots for insert
  to authenticated
  with check (public.crm_user_is_admin());

create policy "crm admins can update crm snapshots"
  on crm_snapshots for update
  to authenticated
  using (public.crm_user_is_admin())
  with check (public.crm_user_is_admin());

create policy "users can read own crm permission"
  on crm_user_permissions for select
  to authenticated
  using (
    public.crm_user_is_admin()
    or user_id = auth.uid()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

create policy "admins can manage crm permissions"
  on crm_user_permissions for all
  to authenticated
  using (public.crm_user_is_admin())
  with check (public.crm_user_is_admin());

insert into crm_snapshots (id)
values ('main')
on conflict (id) do nothing;

insert into crm_user_permissions (email, role, company_key)
values
  ('admin@baltt.com.br', 'admin', null),
  ('crm@baltt.com.br', 'admin', null),
  ('baltt@baltt.com.br', 'empresa', 'baltt'),
  ('vale@baltt.com.br', 'empresa', 'vale'),
  ('baltec@baltt.com.br', 'empresa', 'baltec')
on conflict (email) do update set
  role = excluded.role,
  company_key = excluded.company_key,
  updated_at = now();

update crm_user_permissions permission
set user_id = users.id,
    updated_at = now()
from auth.users users
where permission.user_id is null
  and lower(permission.email) = lower(users.email);

-- ============================================================================
-- Baltt CRM - funcoes de carregar/salvar a base compartilhada
-- ----------------------------------------------------------------------------
-- Este bloco e idempotente e pode ser rodado sozinho no SQL Editor da Supabase.
-- Ele:
--   1. remove versoes antigas (inclusive *_v2) das funcoes de snapshot;
--   2. garante os usuarios admin/empresa em crm_user_permissions;
--   3. recria load_crm_snapshot_for_user() e save_crm_snapshot_for_user(...)
--      com merge por id, para que leads que chegam pelos webhooks (Meta/site)
--      nunca sejam sobrescritos por um navegador com a base desatualizada.
-- ============================================================================

-- 1. Limpa qualquer versao antiga das funcoes (assinaturas diferentes, _v2 etc.)
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'load_crm_snapshot_for_user',
        'load_crm_snapshot_for_user_v2',
        'save_crm_snapshot_for_user',
        'save_crm_snapshot_for_user_v2'
      )
  loop
    execute format('drop function if exists %s', fn.signature);
  end loop;
end
$$;

-- 2. Usuarios do CRM (admin geral + um por empresa)
insert into crm_user_permissions (email, role, company_key)
values
  ('admin@baltt.com.br', 'admin', null),
  ('crm@baltt.com.br', 'admin', null),
  ('baltt@baltt.com.br', 'empresa', 'baltt'),
  ('vale@baltt.com.br', 'empresa', 'vale'),
  ('baltec@baltt.com.br', 'empresa', 'baltec')
on conflict (email) do update set
  role = excluded.role,
  company_key = excluded.company_key,
  updated_at = now();

update crm_user_permissions permission
set user_id = users.id,
    updated_at = now()
from auth.users users
where permission.user_id is null
  and lower(permission.email) = lower(users.email);

insert into crm_snapshots (id)
values ('main')
on conflict (id) do nothing;

-- 3. Carregar a base (filtrada pela empresa do usuario)
create or replace function public.load_crm_snapshot_for_user()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  snapshot_leads jsonb := '[]'::jsonb;
  snapshot_investments jsonb := '[]'::jsonb;
  user_role text;
  user_company_key text;
  user_email text;
  visible_leads jsonb := '[]'::jsonb;
begin
  select permission.role, permission.company_key, permission.email
  into user_role, user_company_key, user_email
  from public.crm_permission_for_current_user() permission;

  user_email := coalesce(user_email, auth.jwt() ->> 'email');

  if user_role is null then
    raise exception 'Usuario % sem permissao no CRM. Cadastre em crm_user_permissions.',
      coalesce(user_email, 'desconhecido');
  end if;

  select
    coalesce(snapshot.leads, '[]'::jsonb),
    coalesce(snapshot.investments, '[]'::jsonb)
  into snapshot_leads, snapshot_investments
  from public.crm_snapshots snapshot
  where snapshot.id = 'main';

  if user_role = 'admin' then
    return jsonb_build_object(
      'leads', snapshot_leads,
      'investments', snapshot_investments,
      'permission', jsonb_build_object(
        'role', 'admin',
        'companyKey', null,
        'allowedCompanies', jsonb_build_array('baltt', 'vale', 'baltec'),
        'email', user_email
      )
    );
  end if;

  if user_company_key is null then
    raise exception 'Usuario % sem empresa liberada no CRM.', coalesce(user_email, 'desconhecido');
  end if;

  select coalesce(jsonb_agg(lead_item.value), '[]'::jsonb)
  into visible_leads
  from jsonb_array_elements(snapshot_leads) as lead_item(value)
  where lead_item.value ->> 'company' = user_company_key;

  return jsonb_build_object(
    'leads', visible_leads,
    'investments', '[]'::jsonb,
    'permission', jsonb_build_object(
      'role', 'empresa',
      'companyKey', user_company_key,
      'allowedCompanies', jsonb_build_array(user_company_key),
      'email', user_email
    )
  );
end;
$$;

-- 4. Salvar a base com merge por id
--    - leads enviados: inseridos/atualizados;
--    - p_deleted_ids: removidos;
--    - leads que ja existiam no banco e nao vieram no envio (ex.: chegaram por
--      webhook depois que o navegador carregou): preservados.
create or replace function public.save_crm_snapshot_for_user(
  p_leads jsonb,
  p_investments jsonb,
  p_deleted_ids text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  safe_leads jsonb := coalesce(p_leads, '[]'::jsonb);
  safe_investments jsonb := coalesce(p_investments, '[]'::jsonb);
  safe_deleted text[] := coalesce(p_deleted_ids, '{}'::text[]);
  user_role text;
  user_company_key text;
  existing_leads jsonb := '[]'::jsonb;
  merged_leads jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(safe_leads) <> 'array' or jsonb_typeof(safe_investments) <> 'array' then
    raise exception 'Formato invalido de leads/investimentos.';
  end if;

  select permission.role, permission.company_key
  into user_role, user_company_key
  from public.crm_permission_for_current_user() permission;

  if user_role is null then
    raise exception 'Usuario sem permissao no CRM.';
  end if;

  if user_role <> 'admin' and user_company_key is null then
    raise exception 'Usuario sem empresa liberada no CRM.';
  end if;

  if user_role <> 'admin' and exists (
    select 1
    from jsonb_array_elements(safe_leads) as lead_item(value)
    where lead_item.value ->> 'company' is distinct from user_company_key
  ) then
    raise exception 'Usuario nao pode salvar leads de outra empresa.';
  end if;

  -- Trava a linha para evitar que dois salvamentos simultaneos se sobrescrevam.
  select coalesce(snapshot.leads, '[]'::jsonb)
  into existing_leads
  from public.crm_snapshots snapshot
  where snapshot.id = 'main'
  for update;

  if existing_leads is null then
    insert into public.crm_snapshots (id) values ('main') on conflict (id) do nothing;
    existing_leads := '[]'::jsonb;
  end if;

  with incoming as (
    select value, ordinality
    from jsonb_array_elements(safe_leads) with ordinality as incoming(value, ordinality)
  ),
  incoming_ids as (
    select coalesce(value ->> 'id', '') as id from incoming
  ),
  kept_existing as (
    -- leads do banco que o navegador nao mandou: ou sao de outra empresa (usuario
    -- empresa) ou chegaram depois do carregamento (webhook). Sao preservados,
    -- exceto os que o usuario apagou explicitamente.
    select distinct on (dedupe_key) value, ordinality
    from (
      select
        existing.value,
        existing.ordinality,
        case
          when coalesce(existing.value ->> 'id', '') = '' then 'noid:' || existing.ordinality
          else 'id:' || (existing.value ->> 'id')
        end as dedupe_key
      from jsonb_array_elements(existing_leads) with ordinality as existing(value, ordinality)
      where coalesce(existing.value ->> 'id', '') not in (select id from incoming_ids where id <> '')
        and (
          user_role <> 'admin' and existing.value ->> 'company' is distinct from user_company_key
          or not (coalesce(existing.value ->> 'id', '') = any (safe_deleted))
        )
    ) filtered
    order by dedupe_key, ordinality
  ),
  all_leads as (
    select value, 0 as bucket, ordinality from incoming
    union all
    select value, 1 as bucket, ordinality from kept_existing
  )
  select coalesce(jsonb_agg(value order by bucket, ordinality), '[]'::jsonb)
  into merged_leads
  from all_leads;

  if user_role = 'admin' then
    update public.crm_snapshots
    set leads = merged_leads,
        investments = safe_investments,
        updated_at = now()
    where id = 'main';
  else
    update public.crm_snapshots
    set leads = merged_leads,
        updated_at = now()
    where id = 'main';
  end if;

  return public.load_crm_snapshot_for_user();
end;
$$;

revoke all on function public.load_crm_snapshot_for_user() from public, anon;
revoke all on function public.save_crm_snapshot_for_user(jsonb, jsonb, text[]) from public, anon;
grant execute on function public.load_crm_snapshot_for_user() to authenticated;
grant execute on function public.save_crm_snapshot_for_user(jsonb, jsonb, text[]) to authenticated;

-- 5. Compatibilidade: versoes antigas do front (com p_email / _v2) continuam
--    funcionando ate o novo deploy. O e-mail e ignorado: a permissao vem do JWT.
--    Atencao: sem p_deleted_ids, exclusoes feitas na versao antiga nao sao
--    propagadas (o merge preserva o lead) - por isso o deploy deve ser feito logo.
create or replace function public.load_crm_snapshot_for_user(p_email text)
returns jsonb language sql stable security definer set search_path = public, auth
as $$ select public.load_crm_snapshot_for_user(); $$;

create or replace function public.load_crm_snapshot_for_user_v2(p_email text)
returns jsonb language sql stable security definer set search_path = public, auth
as $$ select public.load_crm_snapshot_for_user(); $$;

create or replace function public.save_crm_snapshot_for_user(p_leads jsonb, p_investments jsonb, p_email text)
returns void language plpgsql security definer set search_path = public, auth
as $$ begin perform public.save_crm_snapshot_for_user(p_leads, p_investments, '{}'::text[]); end; $$;

create or replace function public.save_crm_snapshot_for_user_v2(p_leads jsonb, p_investments jsonb, p_email text)
returns void language plpgsql security definer set search_path = public, auth
as $$ begin perform public.save_crm_snapshot_for_user(p_leads, p_investments, '{}'::text[]); end; $$;

revoke all on function public.load_crm_snapshot_for_user(text) from public, anon;
revoke all on function public.load_crm_snapshot_for_user_v2(text) from public, anon;
revoke all on function public.save_crm_snapshot_for_user(jsonb, jsonb, text) from public, anon;
revoke all on function public.save_crm_snapshot_for_user_v2(jsonb, jsonb, text) from public, anon;
grant execute on function public.load_crm_snapshot_for_user(text) to authenticated;
grant execute on function public.load_crm_snapshot_for_user_v2(text) to authenticated;
grant execute on function public.save_crm_snapshot_for_user(jsonb, jsonb, text) to authenticated;
grant execute on function public.save_crm_snapshot_for_user_v2(jsonb, jsonb, text) to authenticated;


create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_name text not null,
  whatsapp text,
  focus text,
  created_at timestamptz not null default now()
);

create table if not exists pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  slug text not null,
  name text not null,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  unique (company_id, slug)
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  stage_id uuid not null references pipeline_stages(id),
  arrival_date date not null default current_date,
  name text not null,
  phone text,
  email text,
  city text,
  neighborhood text,
  source text,
  campaign text,
  service text,
  customer_type text,
  contact_status text,
  lead_status text,
  loss_reason text,
  budget_sent numeric(12, 2) default 0,
  proposal_value numeric(12, 2) default 0,
  close_date date,
  qualified text,
  urgency text,
  owner_name text,
  next_follow_up date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  activity_type text not null,
  description text not null,
  due_at timestamptz,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists monthly_investments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  month text not null,
  meta_amount numeric(12, 2) default 0,
  google_amount numeric(12, 2) default 0,
  notes text,
  created_at timestamptz not null default now(),
  unique (company_id, month)
);

create index if not exists leads_company_stage_idx on leads(company_id, stage_id);
create index if not exists leads_arrival_date_idx on leads(arrival_date desc);
create index if not exists leads_source_idx on leads(source);
