alter table public.affiliate_program_settings
  add column if not exists affiliate_trial_days integer not null default 30,
  add column if not exists first_payment_discount_bp integer not null default 2000;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'affiliate_program_settings_trial_days_check'
  ) then
    alter table public.affiliate_program_settings
      add constraint affiliate_program_settings_trial_days_check
      check (affiliate_trial_days between 0 and 365);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'affiliate_program_settings_discount_check'
  ) then
    alter table public.affiliate_program_settings
      add constraint affiliate_program_settings_discount_check
      check (first_payment_discount_bp between 0 and 10000);
  end if;
end $$;

update public.affiliate_program_settings
set affiliate_trial_days = coalesce(affiliate_trial_days, 30),
    first_payment_discount_bp = coalesce(first_payment_discount_bp, 2000)
where id = true;
