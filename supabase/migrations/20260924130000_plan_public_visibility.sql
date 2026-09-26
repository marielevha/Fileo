alter table public.plans
  add column if not exists is_public boolean not null default true;

update public.plans
set is_public = true
where is_public is null;
