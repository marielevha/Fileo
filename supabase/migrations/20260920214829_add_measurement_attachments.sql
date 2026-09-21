alter table public.attachments
  add column measurement_record_id uuid references public.measurement_records(id) on delete cascade;

alter table public.attachments
  drop constraint attachments_has_parent,
  add constraint attachments_has_parent check (
    num_nonnulls(
      client_id,
      order_id,
      order_item_id,
      measurement_record_id,
      financial_movement_id,
      platform_payment_id
    ) >= 1
  );

create index attachments_measurement_record_idx
  on public.attachments (measurement_record_id, created_at desc)
  where measurement_record_id is not null and deleted_at is null;
