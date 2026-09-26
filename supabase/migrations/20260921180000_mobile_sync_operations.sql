create table public.mobile_sync_operations (
  operation_id uuid primary key,
  workshop_id uuid not null references public.workshops(id) on delete cascade,
  actor_user_id uuid not null references public.app_users(id) on delete cascade,
  device_id uuid not null,
  client_created_at timestamptz not null,
  entity_kind text not null,
  entity_id uuid not null,
  depends_on uuid,
  resolution_of uuid,
  action text not null,
  base_version integer,
  payload jsonb not null,
  status text not null check (status in ('applied', 'conflict', 'rejected', 'blocked')),
  result jsonb not null default '{}'::jsonb,
  server_before jsonb,
  created_at timestamptz not null default now(),
  applied_at timestamptz
);

create index mobile_sync_operations_workshop_idx
  on public.mobile_sync_operations (workshop_id, created_at desc);
create index mobile_sync_operations_entity_idx
  on public.mobile_sync_operations (workshop_id, entity_kind, entity_id, created_at);

alter table public.audit_log add column mobile_operation_id uuid;
create unique index audit_log_mobile_operation_idx
  on public.audit_log (mobile_operation_id)
  where mobile_operation_id is not null;

alter table public.mobile_sync_operations enable row level security;
-- Only the server-side PostgreSQL connection processes sync operations.
revoke all on public.mobile_sync_operations from anon, authenticated;
