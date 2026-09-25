alter table public.plans
  add column if not exists trial_days integer not null default 14;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'plans_trial_days_check'
  ) then
    alter table public.plans
      add constraint plans_trial_days_check check (trial_days between 0 and 365);
  end if;
end $$;

update public.plans
set trial_days = 14
where trial_days is null;

alter table public.affiliate_program_settings
  add column if not exists first_payment_commission_type text not null default 'percent',
  add column if not exists first_payment_fixed_amount integer not null default 0,
  add column if not exists sixth_month_commission_type text not null default 'percent',
  add column if not exists sixth_month_fixed_amount integer not null default 0,
  add column if not exists payout_delay_days integer not null default 0,
  add column if not exists public_title text not null default 'Programme d''affiliation Fileo',
  add column if not exists public_description text not null default 'Recommandez Fileo aux ateliers et recevez une commission quand leurs paiements eligibles sont valides.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'affiliate_program_settings_commission_type_check'
  ) then
    alter table public.affiliate_program_settings
      add constraint affiliate_program_settings_commission_type_check
      check (
        first_payment_commission_type in ('percent', 'fixed')
        and sixth_month_commission_type in ('percent', 'fixed')
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'affiliate_program_settings_fixed_amount_check'
  ) then
    alter table public.affiliate_program_settings
      add constraint affiliate_program_settings_fixed_amount_check
      check (first_payment_fixed_amount >= 0 and sixth_month_fixed_amount >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'affiliate_program_settings_payout_delay_check'
  ) then
    alter table public.affiliate_program_settings
      add constraint affiliate_program_settings_payout_delay_check
      check (payout_delay_days between 0 and 365);
  end if;
end $$;

update public.affiliate_program_settings
set public_title = coalesce(nullif(trim(public_title), ''), 'Programme d''affiliation Fileo'),
    public_description = coalesce(nullif(trim(public_description), ''), 'Recommandez Fileo aux ateliers et recevez une commission quand leurs paiements eligibles sont valides.')
where id = true;
