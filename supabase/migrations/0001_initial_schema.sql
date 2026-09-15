-- Fileo Supabase schema
-- Initial relational model for the MongoDB -> PostgreSQL migration.

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create type public.user_status as enum ('active', 'disabled');
create type public.workshop_status as enum ('active', 'suspended', 'closed');
create type public.member_role as enum ('owner', 'manager', 'collaborator');
create type public.member_status as enum ('invited', 'active', 'disabled', 'removed');
create type public.order_item_status as enum ('todo', 'ready', 'in_progress', 'fitting', 'delivered', 'cancelled');
create type public.order_item_work_type as enum ('creation', 'retouche');
create type public.movement_kind as enum ('payment', 'refund', 'correction');
create type public.movement_method as enum ('cash', 'mobile_money', 'bank_transfer', 'card', 'other');
create type public.movement_status as enum ('confirmed', 'voided');
create type public.plan_status as enum ('active', 'archived');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'cancelled', 'expired');
create type public.subscription_period_status as enum ('scheduled', 'active', 'consumed', 'cancelled');
create type public.platform_payment_status as enum ('declared', 'provider_pending', 'validated', 'rejected', 'failed', 'cancelled');
create type public.content_kind as enum ('page', 'faq', 'guide');
create type public.ticket_status as enum ('open', 'in_progress', 'resolved');
create type public.attachment_kind as enum ('measurement_photo', 'model_photo', 'receipt', 'payment_proof', 'other');

-- ---------------------------------------------------------------------------
-- Identity and tenant model
-- ---------------------------------------------------------------------------

create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  full_name text not null,
  phone_e164 text not null unique,
  email text,
  password_hash text,
  status public.user_status not null default 'active',
  platform_roles text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version integer not null default 1,
  constraint app_users_phone_format check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
);

create trigger trg_app_users_updated_at
before update on public.app_users
for each row execute function public.set_updated_at();

create table public.workshops (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.app_users(id) on delete restrict,
  name text not null,
  slug text not null unique,
  country_code char(2) not null,
  city text,
  phone_e164 text,
  currency char(3) not null default 'XAF',
  timezone text not null default 'Africa/Brazzaville',
  receipt_footer text,
  status public.workshop_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version integer not null default 1,
  constraint workshops_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint workshops_currency_upper check (currency = upper(currency)),
  constraint workshops_country_upper check (country_code = upper(country_code)),
  constraint workshops_phone_format check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
);

create trigger trg_workshops_updated_at
before update on public.workshops
for each row execute function public.set_updated_at();

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  role public.member_role not null default 'collaborator',
  can_view_money boolean not null default false,
  status public.member_status not null default 'active',
  invited_at timestamptz,
  joined_at timestamptz,
  disabled_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version integer not null default 1,
  constraint memberships_user_once unique (workshop_id, user_id),
  constraint memberships_owner_money check (role <> 'owner' or can_view_money)
);

create index memberships_user_idx on public.memberships (user_id, status);
create index memberships_workshop_status_idx on public.memberships (workshop_id, status);

create trigger trg_memberships_updated_at
before update on public.memberships
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Customers and measurements
-- ---------------------------------------------------------------------------

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  display_name text not null,
  phone_e164 text,
  phone_search text,
  other_contact text,
  guardian_name text,
  guardian_phone text,
  notes text,
  archived_at timestamptz,
  deleted_at timestamptz,
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version integer not null default 1,
  constraint clients_phone_format check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
);

create index clients_workshop_active_idx on public.clients (workshop_id, deleted_at, archived_at);
create index clients_phone_search_idx on public.clients (workshop_id, phone_search);
create index clients_name_idx on public.clients using gin (to_tsvector('simple', display_name));

create trigger trg_clients_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

create table public.measurement_records (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  template_id text,
  category text not null,
  version integer not null default 1,
  values_json jsonb not null default '{}'::jsonb,
  unit text not null default 'cm',
  notes text,
  taken_at timestamptz not null default now(),
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint measurement_records_version_positive check (version > 0)
);

create index measurement_records_client_idx on public.measurement_records (client_id, taken_at desc);
create index measurement_records_workshop_idx on public.measurement_records (workshop_id, category);

-- ---------------------------------------------------------------------------
-- Orders, items and workshop payments
-- ---------------------------------------------------------------------------

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  reference text not null,
  currency char(3) not null,
  total_amount integer,
  discount_amount integer not null default 0,
  discount_reason text,
  instructions text,
  promised_date date,
  fitting_date date,
  cancelled_at timestamptz,
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version integer not null default 1,
  constraint orders_reference_once unique (workshop_id, reference),
  constraint orders_amounts_positive check (
    (total_amount is null or total_amount >= 0) and discount_amount >= 0
  ),
  constraint orders_currency_upper check (currency = upper(currency))
);

create index orders_workshop_created_idx on public.orders (workshop_id, created_at desc);
create index orders_client_idx on public.orders (client_id, created_at desc);

create trigger trg_orders_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  category text not null,
  description text,
  work_type public.order_item_work_type not null default 'creation',
  wearer_name text,
  wearer_relation text,
  quantity integer not null default 1,
  unit_price_amount integer,
  currency char(3) not null,
  status public.order_item_status not null default 'todo',
  due_date date,
  delivered_quantity integer not null default 0,
  delivered_at timestamptz,
  assignee_user_id uuid references public.app_users(id) on delete set null,
  measurement_snapshot jsonb not null default '{}'::jsonb,
  cancelled_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version integer not null default 1,
  constraint order_items_quantity_positive check (quantity > 0),
  constraint order_items_delivered_bounds check (delivered_quantity >= 0 and delivered_quantity <= quantity),
  constraint order_items_price_positive check (unit_price_amount is null or unit_price_amount >= 0),
  constraint order_items_currency_upper check (currency = upper(currency))
);

create index order_items_order_idx on public.order_items (order_id, sort_order);
create index order_items_planning_idx on public.order_items (workshop_id, due_date, status);
create index order_items_assignee_idx on public.order_items (assignee_user_id, due_date);

create trigger trg_order_items_updated_at
before update on public.order_items
for each row execute function public.set_updated_at();

create table public.order_date_changes (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid references public.order_items(id) on delete cascade,
  previous_due_date date,
  new_due_date date not null,
  reason text,
  changed_by uuid references public.app_users(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index order_date_changes_item_idx on public.order_date_changes (order_item_id, changed_at desc);
create index order_date_changes_order_idx on public.order_date_changes (order_id, changed_at desc);

create table public.financial_movements (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  kind public.movement_kind not null,
  amount integer not null,
  currency char(3) not null,
  method public.movement_method not null,
  reference text,
  effective_date date not null,
  status public.movement_status not null default 'confirmed',
  reverses_id uuid references public.financial_movements(id) on delete restrict,
  void_reason text,
  idempotency_key text,
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  row_version integer not null default 1,
  constraint financial_movements_amount_positive check (amount >= 0),
  constraint financial_movements_currency_upper check (currency = upper(currency))
);

create unique index financial_movements_idempotency_idx
on public.financial_movements (workshop_id, idempotency_key)
where idempotency_key is not null;

create index financial_movements_order_idx on public.financial_movements (order_id, created_at desc);
create index financial_movements_workshop_date_idx on public.financial_movements (workshop_id, effective_date desc);

-- ---------------------------------------------------------------------------
-- Plans, subscriptions and platform payments
-- ---------------------------------------------------------------------------

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  version integer not null default 1,
  name text not null,
  label text not null,
  country_code char(2) not null,
  currency char(3) not null,
  price_amount integer not null,
  billing_period_months integer not null default 1,
  period_months integer not null default 1,
  max_active_members integer not null,
  limits_json jsonb not null default '{}'::jsonb,
  status public.plan_status not null default 'active',
  effective_from date,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint plans_code_version_once unique (code, version),
  constraint plans_positive_values check (
    version > 0 and price_amount >= 0 and billing_period_months > 0 and period_months > 0 and max_active_members > 0
  ),
  constraint plans_currency_upper check (currency = upper(currency)),
  constraint plans_country_upper check (country_code = upper(country_code))
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null unique references public.workshops(id) on delete cascade,
  current_plan_id uuid references public.plans(id) on delete restrict,
  trial_ends_at date,
  current_period_end date,
  grace_ends_at date,
  status public.subscription_status not null default 'trialing',
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version integer not null default 1
);

create trigger trg_subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

create table public.platform_payments (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  plan_id uuid references public.plans(id) on delete restrict,
  amount integer not null,
  currency char(3) not null,
  channel text not null,
  provider text not null default 'manual',
  external_reference text,
  provider_reference_id text,
  provider_external_id text,
  payer_phone_e164 text,
  period_months integer not null default 1,
  status public.platform_payment_status not null default 'declared',
  note text,
  idempotency_key text,
  declared_by uuid references public.app_users(id) on delete set null,
  declared_at timestamptz not null default now(),
  reviewed_by uuid references public.app_users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version integer not null default 1,
  constraint platform_payments_amount_positive check (amount >= 0),
  constraint platform_payments_period_positive check (period_months > 0),
  constraint platform_payments_currency_upper check (currency = upper(currency)),
  constraint platform_payments_payer_phone_format check (
    payer_phone_e164 is null or payer_phone_e164 ~ '^\+[1-9][0-9]{7,14}$'
  )
);

create unique index platform_payments_idempotency_idx
on public.platform_payments (idempotency_key)
where idempotency_key is not null;

create index platform_payments_external_reference_idx
on public.platform_payments (workshop_id, external_reference)
where external_reference is not null;

create index platform_payments_workshop_status_idx on public.platform_payments (workshop_id, status, declared_at desc);
create index platform_payments_provider_reference_idx on public.platform_payments (provider, provider_reference_id);

create trigger trg_platform_payments_updated_at
before update on public.platform_payments
for each row execute function public.set_updated_at();

create table public.subscription_periods (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete restrict,
  source_payment_id uuid references public.platform_payments(id) on delete set null,
  period_start date not null,
  period_end date not null,
  status public.subscription_period_status not null default 'scheduled',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version integer not null default 1,
  constraint subscription_periods_dates_order check (period_end > period_start)
);

create index subscription_periods_current_idx
on public.subscription_periods (workshop_id, period_start, period_end, status);

create unique index subscription_periods_payment_idx
on public.subscription_periods (source_payment_id)
where source_payment_id is not null;

create trigger trg_subscription_periods_updated_at
before update on public.subscription_periods
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Files and support
-- ---------------------------------------------------------------------------

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid references public.workshops(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  order_item_id uuid references public.order_items(id) on delete cascade,
  financial_movement_id uuid references public.financial_movements(id) on delete cascade,
  platform_payment_id uuid references public.platform_payments(id) on delete cascade,
  kind public.attachment_kind not null default 'other',
  bucket text not null default 'fileo',
  storage_path text not null unique,
  original_filename text,
  mime_type text,
  size_bytes bigint,
  checksum_sha256 text,
  uploaded_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint attachments_has_parent check (
    num_nonnulls(client_id, order_id, order_item_id, financial_movement_id, platform_payment_id) >= 1
  ),
  constraint attachments_size_positive check (size_bytes is null or size_bytes >= 0)
);

create index attachments_workshop_idx on public.attachments (workshop_id, created_at desc);
create index attachments_order_idx on public.attachments (order_id, order_item_id, created_at desc);

create table public.contents (
  id uuid primary key default gen_random_uuid(),
  kind public.content_kind not null,
  slug text not null,
  locale text not null default 'fr',
  title text not null,
  body_json jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version integer not null default 1,
  constraint contents_unique unique (kind, slug, locale)
);

create trigger trg_contents_updated_at
before update on public.contents
for each row execute function public.set_updated_at();

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid references public.workshops(id) on delete set null,
  requester_user_id uuid references public.app_users(id) on delete set null,
  requester_name text,
  requester_contact text,
  assignee_user_id uuid references public.app_users(id) on delete set null,
  name text not null,
  email text,
  phone text,
  subject text not null,
  category text,
  message text not null,
  body text,
  status public.ticket_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version integer not null default 1
);

create index tickets_status_idx on public.tickets (status, created_at desc);

create trigger trg_tickets_updated_at
before update on public.tickets
for each row execute function public.set_updated_at();

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid references public.workshops(id) on delete set null,
  actor_user_id uuid references public.app_users(id) on delete set null,
  action text not null,
  entity_kind text not null,
  entity_id uuid,
  reason text,
  before_json jsonb,
  after_json jsonb,
  ip_address inet,
  created_at timestamptz not null default now()
);

create index audit_log_workshop_idx on public.audit_log (workshop_id, created_at desc);
create index audit_log_entity_idx on public.audit_log (entity_kind, entity_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS-ready security layer
-- ---------------------------------------------------------------------------

create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.app_users
  where auth_user_id = auth.uid()
  limit 1
$$;

create or replace function public.is_workshop_member(target_workshop_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.workshop_id = target_workshop_id
      and m.user_id = public.current_app_user_id()
      and m.status = 'active'
  )
$$;

alter table public.workshops enable row level security;
alter table public.memberships enable row level security;
alter table public.clients enable row level security;
alter table public.measurement_records enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_date_changes enable row level security;
alter table public.financial_movements enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_periods enable row level security;
alter table public.platform_payments enable row level security;
alter table public.attachments enable row level security;
alter table public.audit_log enable row level security;

create policy workshops_member_select
on public.workshops for select
using (public.is_workshop_member(id));

create policy memberships_member_select
on public.memberships for select
using (public.is_workshop_member(workshop_id));

create policy tenant_clients_select
on public.clients for select
using (public.is_workshop_member(workshop_id));

create policy tenant_measurement_records_select
on public.measurement_records for select
using (public.is_workshop_member(workshop_id));

create policy tenant_orders_select
on public.orders for select
using (public.is_workshop_member(workshop_id));

create policy tenant_order_items_select
on public.order_items for select
using (public.is_workshop_member(workshop_id));

create policy tenant_order_date_changes_select
on public.order_date_changes for select
using (public.is_workshop_member(workshop_id));

create policy tenant_financial_movements_select
on public.financial_movements for select
using (public.is_workshop_member(workshop_id));

create policy tenant_subscriptions_select
on public.subscriptions for select
using (public.is_workshop_member(workshop_id));

create policy tenant_subscription_periods_select
on public.subscription_periods for select
using (public.is_workshop_member(workshop_id));

create policy tenant_platform_payments_select
on public.platform_payments for select
using (public.is_workshop_member(workshop_id));

create policy tenant_attachments_select
on public.attachments for select
using (workshop_id is not null and public.is_workshop_member(workshop_id));

create policy tenant_audit_log_select
on public.audit_log for select
using (workshop_id is not null and public.is_workshop_member(workshop_id));

-- Writes are intentionally kept server-side for V1 via the Supabase service role.
-- Direct client writes can be added later per workflow once validation rules are
-- moved into database functions.

commit;
