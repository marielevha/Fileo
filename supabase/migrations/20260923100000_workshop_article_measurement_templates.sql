begin;

create table public.workshop_article_types (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  name text not null,
  description text,
  default_work_type public.order_item_work_type not null default 'creation',
  active boolean not null default true,
  sort_order integer not null default 0,
  deleted_at timestamptz,
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version integer not null default 1,
  constraint workshop_article_types_name_length check (char_length(btrim(name)) between 2 and 80),
  constraint workshop_article_types_sort_order_positive check (sort_order >= 0)
);

create unique index workshop_article_types_name_once
  on public.workshop_article_types (workshop_id, lower(btrim(name)))
  where deleted_at is null;

create index workshop_article_types_list_idx
  on public.workshop_article_types (workshop_id, active desc, sort_order, name)
  where deleted_at is null;

create trigger trg_workshop_article_types_updated_at
before update on public.workshop_article_types
for each row execute function public.set_updated_at();

create table public.measurement_templates (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  article_type_id uuid not null references public.workshop_article_types(id) on delete cascade,
  name text not null,
  fields_json jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  sort_order integer not null default 0,
  deleted_at timestamptz,
  created_by uuid references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version integer not null default 1,
  constraint measurement_templates_name_length check (char_length(btrim(name)) between 2 and 80),
  constraint measurement_templates_fields_array check (jsonb_typeof(fields_json) = 'array'),
  constraint measurement_templates_sort_order_positive check (sort_order >= 0)
);

create unique index measurement_templates_article_once
  on public.measurement_templates (article_type_id)
  where deleted_at is null;

create index measurement_templates_list_idx
  on public.measurement_templates (workshop_id, active desc, sort_order, name)
  where deleted_at is null;

create trigger trg_measurement_templates_updated_at
before update on public.measurement_templates
for each row execute function public.set_updated_at();

alter table public.workshop_article_types enable row level security;
alter table public.measurement_templates enable row level security;

create policy tenant_workshop_article_types_select
on public.workshop_article_types for select
using (public.is_workshop_member(workshop_id));

create policy tenant_measurement_templates_select
on public.measurement_templates for select
using (public.is_workshop_member(workshop_id));

commit;
