# Supabase SQL schema

This document explains the relational target model for the Supabase migration.
The executable draft is in `supabase/migrations/0001_initial_schema.sql`.

## Design principles

- `workshop_id` is the tenant boundary for every business table.
- Monetary values stay as integers in the smallest currency unit, with a
  separate `currency` column.
- Business dates use `date`; audit and event timestamps use `timestamptz`.
- UUID primary keys keep compatibility with the current MongoDB string IDs.
- Writes stay server-side for the first Supabase version. RLS select policies
  are present so the model is ready for direct Supabase clients later.
- Supabase Auth is linked through `app_users.auth_user_id`. Existing phone and
  password-hash data can be migrated first, then accounts can be progressively
  attached to `auth.users`.

## Main domains

Identity:

- `app_users`: application users and optional Supabase Auth link.
- `workshops`: tailoring workshops.
- `memberships`: user access to each workshop, including role, money access and
  active/disabled state.

Commercial workflow:

- `clients`: customer files for each workshop.
- `measurement_records`: historical measurements at client level, kept for
  compatibility and future reuse.
- `orders`: order header, client, dates and commercial totals.
- `order_items`: garments or services. Each item carries `work_type` and
  `measurement_snapshot`, matching the current product decision that
  measurements are captured per article in V1.
- `order_date_changes`: trace of planning changes per order/item.
- `financial_movements`: payments, refunds and corrections for client orders.

Subscriptions:

- `plans`: Fileo offers and versions.
- `subscriptions`: one subscription envelope per workshop.
- `platform_payments`: declarations or provider payments, manual or MTN MoMo.
- `subscription_periods`: the normalized subscription queue. This prevents a
  newly validated Pro payment from replacing the current Essential period before
  its end date.

Files:

- `attachments`: metadata for files stored in Supabase Storage. It can point to
  clients, orders, order items, workshop payments or subscription payments.
- Suggested private bucket: `fileo`.
- Suggested path convention:
  `workshops/{workshop_id}/orders/{order_id}/items/{order_item_id}/{attachment_id}-{filename}`.

Support and admin:

- `contents`: public pages, FAQ and guides.
- `tickets`: support contact messages.
- `audit_log`: immutable business trace for important actions.

## Open decisions before implementation

- Whether to keep `password_hash` during a transition period or migrate all
  users to Supabase Auth immediately.
- Whether attachments should be uploaded only by the server or directly by
  authenticated workshop members using signed upload URLs.
- Whether financial writes should remain exclusively in server actions or move
  behind PostgreSQL functions with stricter RLS policies.
- Whether to use generated columns/materialized views for order balances, or
  keep balances computed by the application as today.
