create table if not exists public.affiliate_program_settings (
  id boolean primary key default true,
  enabled boolean not null default true,
  first_payment_rate_bp integer not null default 2000 check (first_payment_rate_bp between 0 and 10000),
  sixth_month_rate_bp integer not null default 1000 check (sixth_month_rate_bp between 0 and 10000),
  sixth_month_threshold_months integer not null default 6 check (sixth_month_threshold_months > 0),
  updated_at timestamptz not null default now(),
  constraint affiliate_program_settings_singleton check (id)
);

insert into public.affiliate_program_settings(id)
values(true)
on conflict(id) do nothing;

create table if not exists public.affiliate_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.app_users(id) on delete set null,
  code text not null unique check (code ~ '^[A-Z0-9][A-Z0-9_-]{3,31}$'),
  display_name text not null,
  phone_e164 text,
  email text,
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

create table if not exists public.affiliate_attributions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_profiles(id),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  referral_code text not null,
  attributed_at timestamptz not null default now(),
  created_by_user_id uuid references public.app_users(id) on delete set null,
  unique(workshop_id)
);

create table if not exists public.affiliate_commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliate_profiles(id),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  platform_payment_id uuid references public.platform_payments(id) on delete set null,
  milestone text not null check (milestone in ('first_payment','sixth_month')),
  amount integer not null check (amount >= 0),
  currency text not null,
  rate_bp integer not null check (rate_bp between 0 and 10000),
  status text not null default 'pending' check (status in ('pending','paid','cancelled')),
  due_at date not null default current_date,
  paid_at timestamptz,
  paid_by uuid references public.app_users(id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workshop_id, milestone)
);

create index if not exists affiliate_attributions_affiliate_idx on public.affiliate_attributions(affiliate_id);
create index if not exists affiliate_commissions_affiliate_status_idx on public.affiliate_commissions(affiliate_id,status);
create index if not exists affiliate_commissions_status_due_idx on public.affiliate_commissions(status,due_at);

alter table public.affiliate_program_settings enable row level security;
alter table public.affiliate_profiles enable row level security;
alter table public.affiliate_attributions enable row level security;
alter table public.affiliate_commissions enable row level security;
