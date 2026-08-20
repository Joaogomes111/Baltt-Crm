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
  current_role text;
  current_company_key text;
  current_email text;
  visible_leads jsonb := '[]'::jsonb;
begin
  select permission.role, permission.company_key, permission.email
  into current_role, current_company_key, current_email
  from public.crm_permission_for_current_user() permission;

  current_email := coalesce(current_email, auth.jwt() ->> 'email');

  select
    coalesce(snapshot.leads, '[]'::jsonb),
    coalesce(snapshot.investments, '[]'::jsonb)
  into snapshot_leads, snapshot_investments
  from public.crm_snapshots snapshot
  where snapshot.id = 'main';

  if current_role = 'admin' then
    return jsonb_build_object(
      'leads', snapshot_leads,
      'investments', snapshot_investments,
      'permission', jsonb_build_object(
        'role', 'admin',
        'companyKey', null,
        'allowedCompanies', jsonb_build_array('baltt', 'vale', 'baltec'),
        'email', current_email
      )
    );
  end if;

  if current_company_key is not null then
    select coalesce(jsonb_agg(lead_item.value), '[]'::jsonb)
    into visible_leads
    from jsonb_array_elements(snapshot_leads) as lead_item(value)
    where lead_item.value ->> 'company' = current_company_key;
  end if;

  return jsonb_build_object(
    'leads', visible_leads,
    'investments', '[]'::jsonb,
    'permission', jsonb_build_object(
      'role', 'empresa',
      'companyKey', current_company_key,
      'allowedCompanies',
        case
          when current_company_key is null then '[]'::jsonb
          else jsonb_build_array(current_company_key)
        end,
      'email', current_email
    )
  );
end;
$$;

create or replace function public.save_crm_snapshot_for_user(
  p_leads jsonb,
  p_investments jsonb
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  safe_leads jsonb := coalesce(p_leads, '[]'::jsonb);
  safe_investments jsonb := coalesce(p_investments, '[]'::jsonb);
  current_role text;
  current_company_key text;
  merged_leads jsonb := '[]'::jsonb;
begin
  select permission.role, permission.company_key
  into current_role, current_company_key
  from public.crm_permission_for_current_user() permission;

  if current_role is null then
    raise exception 'Usuario sem permissao no CRM.';
  end if;

  if current_role = 'admin' then
    update public.crm_snapshots
    set leads = safe_leads,
        investments = safe_investments,
        updated_at = now()
    where id = 'main';
    return;
  end if;

  if current_company_key is null then
    raise exception 'Usuario sem empresa liberada no CRM.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(safe_leads) as lead_item(value)
    where lead_item.value ->> 'company' is distinct from current_company_key
  ) then
    raise exception 'Usuario nao pode salvar leads de outra empresa.';
  end if;

  select coalesce(jsonb_agg(all_leads.value), '[]'::jsonb)
  into merged_leads
  from (
    select existing_leads.value
    from public.crm_snapshots snapshot
    cross join jsonb_array_elements(coalesce(snapshot.leads, '[]'::jsonb)) as existing_leads(value)
    where snapshot.id = 'main'
      and existing_leads.value ->> 'company' is distinct from current_company_key
    union all
    select incoming_leads.value
    from jsonb_array_elements(safe_leads) as incoming_leads(value)
  ) all_leads;

  update public.crm_snapshots
  set leads = merged_leads,
      updated_at = now()
  where id = 'main';
end;
$$;

grant execute on function public.load_crm_snapshot_for_user() to authenticated;
grant execute on function public.save_crm_snapshot_for_user(jsonb, jsonb) to authenticated;

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
