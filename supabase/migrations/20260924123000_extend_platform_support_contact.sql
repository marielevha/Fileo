alter table public.platform_support_contact
  add column if not exists app_version text not null default '1.0.0',
  add column if not exists company_name text not null default 'Nzelobi';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'platform_support_contact_app_version_check'
  ) then
    alter table public.platform_support_contact
      add constraint platform_support_contact_app_version_check
      check (length(trim(app_version)) between 1 and 40);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'platform_support_contact_company_name_check'
  ) then
    alter table public.platform_support_contact
      add constraint platform_support_contact_company_name_check
      check (length(trim(company_name)) between 1 and 80);
  end if;
end $$;

update public.platform_support_contact
set app_version = coalesce(nullif(trim(app_version), ''), '1.0.0'),
    company_name = coalesce(nullif(trim(company_name), ''), 'Nzelobi')
where id = true;
