create table if not exists public.platform_support_contact (
  id boolean primary key default true check (id),
  email text not null check (length(email) <= 254 and email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.app_users(id) on delete set null,
  row_version integer not null default 1 check (row_version > 0)
);

alter table public.platform_support_contact enable row level security;
revoke all on table public.platform_support_contact from anon, authenticated;

insert into public.platform_support_contact (id, email)
values (true, 'support@fileo.app')
on conflict (id) do nothing;
