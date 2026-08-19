create extension if not exists pgcrypto;

create table if not exists crm_snapshots (
  id text primary key default 'main' check (id = 'main'),
  leads jsonb not null default '[]'::jsonb,
  investments jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table crm_snapshots enable row level security;

drop policy if exists "authenticated users can read crm snapshots" on crm_snapshots;
drop policy if exists "authenticated users can insert crm snapshots" on crm_snapshots;
drop policy if exists "authenticated users can update crm snapshots" on crm_snapshots;

create policy "authenticated users can read crm snapshots"
  on crm_snapshots for select
  to authenticated
  using (true);

create policy "authenticated users can insert crm snapshots"
  on crm_snapshots for insert
  to authenticated
  with check (true);

create policy "authenticated users can update crm snapshots"
  on crm_snapshots for update
  to authenticated
  using (true)
  with check (true);

insert into crm_snapshots (id)
values ('main')
on conflict (id) do nothing;

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
