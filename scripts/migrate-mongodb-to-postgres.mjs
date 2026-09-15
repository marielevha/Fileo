import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { MongoClient } from "mongodb";
import pg from "pg";

const { Client } = pg;

const ROOT = process.cwd();
const MONGO_ENV = "atlas-credentials.env";
const SUPABASE_ENV = "config-supabase.env";
const SCHEMA_FILE = join(ROOT, "supabase", "migrations", "0001_initial_schema.sql");

if (!process.env.MONGODB_URI && existsSync(MONGO_ENV)) process.loadEnvFile(MONGO_ENV);
if (!process.env.SUPABASE_DB_URL && !process.env.SUPABASE_POOLER_DB_URL && existsSync(SUPABASE_ENV)) {
  process.loadEnvFile(SUPABASE_ENV);
}

const replace = process.argv.includes("--replace");
const applySchema = process.argv.includes("--apply-schema");
const dryRun = process.argv.includes("--dry-run");
let knownUserIds = new Set();

if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI est absent.");
const postgresUrl = process.env.SUPABASE_POOLER_DB_URL || process.env.SUPABASE_DB_URL;

if (!postgresUrl && !dryRun) {
  throw new Error("SUPABASE_DB_URL ou SUPABASE_POOLER_DB_URL est absent. Renseignez config-supabase.env ou lancez avec --dry-run.");
}

const mongo = new MongoClient(process.env.MONGODB_URI);
await mongo.connect();

let pgClient = null;
if (!dryRun) {
  pgClient = new Client({
    connectionString: postgresUrl,
    ssl: postgresUrl.includes("supabase.co") || postgresUrl.includes("pooler.supabase.com")
      ? { rejectUnauthorized: false }
      : undefined,
  });
  await pgClient.connect();
}

try {
  const mongoDb = mongo.db(process.env.MONGODB_DB ?? "fileo");
  const source = await readCollections(mongoDb);
  const rows = buildRows(source);

  printPlan(rows);

  if (dryRun) {
    console.log("\nDry-run uniquement: aucune ecriture Postgres.");
    process.exitCode = 0;
  } else {
    await migrate(pgClient, rows);
  }
} finally {
  await mongo.close();
  if (pgClient) await pgClient.end();
}

async function readCollections(db) {
  const names = [
    "users",
    "workshops",
    "memberships",
    "clients",
    "measurement_records",
    "plans",
    "subscriptions",
    "orders",
    "order_items",
    "order_date_changes",
    "financial_movements",
    "platform_payments",
    "contents",
    "tickets",
    "audit_log",
  ];
  const entries = await Promise.all(
    names.map(async (name) => [name, await db.collection(name).find({}, { projection: { _id: 0 } }).toArray()]),
  );
  return Object.fromEntries(entries);
}

function buildRows(source) {
  const plansById = new Map(source.plans.map((row) => [String(row.id), row]));
  const subscriptionsById = new Map(source.subscriptions.map((row) => [String(row.id), row]));
  knownUserIds = new Set(source.users.map((row) => toPgUuid(String(row.id))));

  return {
    app_users: source.users.map(mapUser),
    workshops: source.workshops.map(mapWorkshop),
    plans: source.plans.map(mapPlan),
    memberships: source.memberships.map(mapMembership),
    clients: source.clients.map(mapClient),
    measurement_records: source.measurement_records.map(mapMeasurementRecord),
    subscriptions: source.subscriptions.map(mapSubscription),
    orders: source.orders.map(mapOrder),
    order_items: source.order_items.map(mapOrderItem),
    order_date_changes: source.order_date_changes.map(mapOrderDateChange),
    financial_movements: source.financial_movements.map(mapFinancialMovement),
    platform_payments: source.platform_payments.map(mapPlatformPayment),
    subscription_periods: buildSubscriptionPeriods(source.platform_payments, subscriptionsById, plansById),
    contents: source.contents.map(mapContent),
    tickets: source.tickets.map(mapTicket),
    audit_log: source.audit_log.map(mapAuditLog),
  };
}

async function migrate(client, rows) {
  await client.query("begin");
  try {
    if (applySchema) {
      if (replace) {
        console.log("Reinitialisation du schema public Fileo...");
        await client.query(resetSchemaSql());
      }
      console.log("Application du schema SQL...");
      await client.query(schemaSql());
    }

    if (replace) {
      console.log("Vidage des tables cible...");
      await client.query(`
        truncate table
          public.audit_log,
          public.tickets,
          public.contents,
          public.attachments,
          public.subscription_periods,
          public.platform_payments,
          public.financial_movements,
          public.order_date_changes,
          public.order_items,
          public.orders,
          public.measurement_records,
          public.clients,
          public.memberships,
          public.subscriptions,
          public.plans,
          public.workshops,
          public.app_users
        restart identity cascade
      `);
    } else {
      const { rows: existing } = await client.query(`
        select relname as table_name, n_live_tup::bigint as estimated_rows
        from pg_stat_user_tables
        where schemaname = 'public'
          and relname in ('app_users', 'workshops', 'plans', 'orders', 'platform_payments')
          and n_live_tup > 0
      `);
      if (existing.length > 0) {
        throw new Error("La base Postgres cible contient deja des donnees. Relancez avec --replace pour l'ecraser explicitement.");
      }
    }

    for (const table of migrationOrder()) {
      await insertRows(client, table, rows[table]);
      console.log(`${table.padEnd(28)} ${String(rows[table].length).padStart(5)}`);
    }

    await client.query("commit");
    console.log("\nMigration MongoDB -> Postgres terminee.");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

function migrationOrder() {
  return [
    "app_users",
    "workshops",
    "plans",
    "memberships",
    "clients",
    "measurement_records",
    "subscriptions",
    "orders",
    "order_items",
    "order_date_changes",
    "financial_movements",
    "platform_payments",
    "subscription_periods",
    "contents",
    "tickets",
    "audit_log",
  ];
}

function schemaSql() {
  return readFileSync(SCHEMA_FILE, "utf8")
    .replace(/^\s*begin;\s*/i, "")
    .replace(/\s*commit;\s*$/i, "");
}

function resetSchemaSql() {
  return `
    drop table if exists
      public.audit_log,
      public.tickets,
      public.contents,
      public.attachments,
      public.subscription_periods,
      public.platform_payments,
      public.financial_movements,
      public.order_date_changes,
      public.order_items,
      public.orders,
      public.measurement_records,
      public.clients,
      public.memberships,
      public.subscriptions,
      public.plans,
      public.workshops,
      public.app_users
    cascade;

    drop function if exists public.is_workshop_member(uuid) cascade;
    drop function if exists public.current_app_user_id() cascade;
    drop function if exists public.set_updated_at() cascade;

    drop type if exists public.attachment_kind cascade;
    drop type if exists public.ticket_status cascade;
    drop type if exists public.content_kind cascade;
    drop type if exists public.platform_payment_status cascade;
    drop type if exists public.subscription_period_status cascade;
    drop type if exists public.subscription_status cascade;
    drop type if exists public.plan_status cascade;
    drop type if exists public.movement_status cascade;
    drop type if exists public.movement_method cascade;
    drop type if exists public.movement_kind cascade;
    drop type if exists public.order_item_work_type cascade;
    drop type if exists public.order_item_status cascade;
    drop type if exists public.member_status cascade;
    drop type if exists public.member_role cascade;
    drop type if exists public.workshop_status cascade;
    drop type if exists public.user_status cascade;
  `;
}

async function insertRows(client, table, rows) {
  if (!rows.length) return;
  for (const row of rows) {
    const entries = Object.entries(row).filter(([, value]) => value !== undefined);
    const columns = entries.map(([key]) => quoteIdent(key)).join(", ");
    const placeholders = entries.map((_, index) => `$${index + 1}`).join(", ");
    const values = entries.map(([, value]) => serializePgValue(value));
    await client.query(
      `insert into public.${quoteIdent(table)} (${columns}) values (${placeholders})`,
      values,
    );
  }
}

function mapUser(row) {
  return {
    id: uuid(row.id),
    full_name: requiredText(row.full_name, "Utilisateur sans nom"),
    phone_e164: requiredText(row.phone_e164, "Utilisateur sans telephone"),
    email: nullableText(row.email),
    password_hash: nullableText(row.password_hash),
    status: mapUserStatus(row.status),
    platform_roles: toTextArray(row.platform_roles),
    created_at: timestamp(row.created_at),
    updated_at: timestamp(row.updated_at),
    row_version: int(row.row_version, 1),
  };
}

function mapWorkshop(row) {
  return {
    id: uuid(row.id),
    owner_user_id: uuid(row.owner_user_id),
    name: requiredText(row.name, "Atelier sans nom"),
    slug: slug(row.slug ?? row.name),
    country_code: requiredText(row.country_code ?? "CG", "Pays atelier manquant"),
    city: nullableText(row.city),
    phone_e164: nullableText(row.phone_e164),
    currency: requiredText(row.currency ?? "XAF", "Devise atelier manquante"),
    timezone: requiredText(row.timezone ?? "Africa/Brazzaville", "Fuseau atelier manquant"),
    receipt_footer: nullableText(row.receipt_footer),
    status: mapWorkshopStatus(row.status),
    created_at: timestamp(row.created_at),
    updated_at: timestamp(row.updated_at),
    row_version: int(row.row_version, 1),
  };
}

function mapMembership(row) {
  return {
    id: uuid(row.id),
    workshop_id: uuid(row.workshop_id),
    user_id: uuid(row.user_id),
    role: mapMemberRole(row.role),
    can_view_money: bool(row.can_view_money),
    status: mapMemberStatus(row.status),
    invited_at: nullableTimestamp(row.invited_at),
    joined_at: nullableTimestamp(row.joined_at),
    disabled_at: nullableTimestamp(row.disabled_at),
    removed_at: nullableTimestamp(row.removed_at),
    created_at: timestamp(row.created_at),
    updated_at: timestamp(row.updated_at),
    row_version: int(row.row_version, 1),
  };
}

function mapClient(row) {
  return {
    id: uuid(row.id),
    workshop_id: uuid(row.workshop_id),
    display_name: requiredText(row.display_name, "Client sans nom"),
    phone_e164: nullableText(row.phone_e164),
    phone_search: nullableText(row.phone_search),
    other_contact: nullableText(row.other_contact),
    guardian_name: nullableText(row.guardian_name),
    guardian_phone: nullableText(row.guardian_phone),
    notes: nullableText(row.notes),
    archived_at: nullableTimestamp(row.archived_at),
    deleted_at: nullableTimestamp(row.deleted_at),
    created_by: nullableUserUuid(row.created_by),
    created_at: timestamp(row.created_at),
    updated_at: timestamp(row.updated_at),
    row_version: int(row.row_version, 1),
  };
}

function mapMeasurementRecord(row) {
  return {
    id: uuid(row.id),
    workshop_id: uuid(row.workshop_id),
    client_id: uuid(row.client_id),
    template_id: nullableText(row.template_id),
    category: requiredText(row.category, "Categorie mesure manquante"),
    version: int(row.version, 1),
    values_json: json(row.values_json, {}),
    unit: requiredText(row.unit ?? "cm", "Unite mesure manquante"),
    notes: nullableText(row.notes),
    taken_at: timestamp(row.taken_at ?? row.created_at),
    created_by: nullableUserUuid(row.created_by),
    created_at: timestamp(row.created_at),
  };
}

function mapPlan(row) {
  const limits = json(row.limits_json, {});
  const label = row.label ?? row.name ?? row.code;
  const periodMonths = int(row.period_months ?? row.billing_period_months, 1);
  return {
    id: uuid(row.id),
    code: requiredText(row.code, "Code offre manquant"),
    version: int(row.version, 1),
    name: requiredText(row.name ?? label, "Nom offre manquant"),
    label: requiredText(label, "Libelle offre manquant"),
    country_code: requiredText(row.country_code ?? "CG", "Pays offre manquant"),
    currency: requiredText(row.currency ?? "XAF", "Devise offre manquante"),
    price_amount: int(row.price_amount, 0),
    billing_period_months: periodMonths,
    period_months: periodMonths,
    max_active_members: int(row.max_active_members ?? limits.members, 1),
    limits_json: limits,
    status: row.archived_at ? "archived" : "active",
    effective_from: dateOnly(row.effective_from),
    created_at: timestamp(row.created_at),
    archived_at: nullableTimestamp(row.archived_at),
  };
}

function mapSubscription(row) {
  return {
    id: uuid(row.id),
    workshop_id: uuid(row.workshop_id),
    current_plan_id: nullableUuid(row.plan_id),
    trial_ends_at: dateOnly(row.trial_ends_at),
    current_period_end: dateOnly(row.current_period_end),
    grace_ends_at: dateOnly(row.grace_ends_at),
    status: mapSubscriptionStatus(row.status),
    cancel_at_period_end: bool(row.cancel_at_period_end),
    cancelled_at: nullableTimestamp(row.cancelled_at),
    created_at: timestamp(row.created_at),
    updated_at: timestamp(row.updated_at),
    row_version: int(row.row_version, 1),
  };
}

function mapOrder(row) {
  return {
    id: uuid(row.id),
    workshop_id: uuid(row.workshop_id),
    client_id: uuid(row.client_id),
    reference: requiredText(row.reference, "Reference commande manquante"),
    currency: requiredText(row.currency ?? "XAF", "Devise commande manquante"),
    total_amount: nullableInt(row.total_amount),
    discount_amount: int(row.discount_amount, 0),
    discount_reason: nullableText(row.discount_reason),
    instructions: nullableText(row.instructions),
    promised_date: dateOnly(row.promised_date),
    fitting_date: dateOnly(row.fitting_date),
    cancelled_at: nullableTimestamp(row.cancelled_at),
    created_by: nullableUserUuid(row.created_by),
    created_at: timestamp(row.created_at),
    updated_at: timestamp(row.updated_at),
    row_version: int(row.row_version, 1),
  };
}

function mapOrderItem(row) {
  return {
    id: uuid(row.id),
    workshop_id: uuid(row.workshop_id),
    order_id: uuid(row.order_id),
    category: requiredText(row.category, "Categorie article manquante"),
    description: nullableText(row.description),
    work_type: mapWorkType(row.work_type),
    wearer_name: nullableText(row.wearer_name),
    wearer_relation: nullableText(row.wearer_relation),
    quantity: int(row.quantity, 1),
    unit_price_amount: nullableInt(row.unit_price_amount),
    currency: requiredText(row.currency ?? "XAF", "Devise article manquante"),
    status: mapOrderItemStatus(row.status),
    due_date: dateOnly(row.due_date),
    delivered_quantity: int(row.delivered_quantity, 0),
    delivered_at: nullableTimestamp(row.delivered_at),
    assignee_user_id: nullableUserUuid(row.assignee_user_id),
    measurement_snapshot: json(row.measurement_snapshot, {}),
    cancelled_at: nullableTimestamp(row.cancelled_at),
    sort_order: int(row.sort_order, 0),
    created_at: timestamp(row.created_at),
    updated_at: timestamp(row.updated_at),
    row_version: int(row.row_version, 1),
  };
}

function mapOrderDateChange(row) {
  return {
    id: uuid(row.id),
    workshop_id: uuid(row.workshop_id),
    order_id: uuid(row.order_id),
    order_item_id: nullableUuid(row.order_item_id),
    previous_due_date: dateOnly(row.previous_due_date),
    new_due_date: requiredDate(row.new_due_date, "Nouvelle echeance manquante"),
    reason: nullableText(row.reason),
    changed_by: nullableUserUuid(row.changed_by),
    changed_at: timestamp(row.changed_at),
  };
}

function mapFinancialMovement(row) {
  return {
    id: uuid(row.id),
    workshop_id: uuid(row.workshop_id),
    order_id: uuid(row.order_id),
    kind: mapMovementKind(row.kind),
    amount: int(row.amount, 0),
    currency: requiredText(row.currency ?? "XAF", "Devise mouvement manquante"),
    method: mapMovementMethod(row.method),
    reference: nullableText(row.reference),
    effective_date: requiredDate(row.effective_date, "Date mouvement manquante"),
    status: mapMovementStatus(row.status),
    reverses_id: nullableUuid(row.reverses_id),
    void_reason: nullableText(row.void_reason),
    idempotency_key: nullableText(row.idempotency_key),
    created_by: nullableUserUuid(row.created_by),
    created_at: timestamp(row.created_at),
    row_version: int(row.row_version, 1),
  };
}

function mapPlatformPayment(row) {
  return {
    id: uuid(row.id),
    workshop_id: uuid(row.workshop_id),
    subscription_id: nullableUuid(row.subscription_id),
    plan_id: nullableUuid(row.plan_id),
    amount: int(row.amount, 0),
    currency: requiredText(row.currency ?? "XAF", "Devise reglement manquante"),
    channel: requiredText(row.channel ?? row.provider ?? "manual", "Canal reglement manquant"),
    provider: requiredText(row.provider ?? "manual", "Provider reglement manquant"),
    external_reference: nullableText(row.external_reference),
    provider_reference_id: nullableText(row.provider_reference_id),
    provider_external_id: nullableText(row.external_id ?? row.provider_external_id),
    payer_phone_e164: nullableText(row.payer_phone ?? row.payer_phone_e164),
    period_months: int(row.period_months, 1),
    status: mapPlatformPaymentStatus(row.status),
    note: nullableText(row.note),
    idempotency_key: nullableText(row.idempotency_key),
    declared_by: nullableUserUuid(row.declared_by),
    declared_at: timestamp(row.declared_at),
    reviewed_by: nullableUserUuid(row.reviewed_by),
    reviewed_at: nullableTimestamp(row.reviewed_at),
    review_note: nullableText(row.review_note),
    raw_payload: json(row.provider_payload ?? row.raw_payload, {}),
    created_at: timestamp(row.created_at ?? row.declared_at),
    updated_at: timestamp(row.updated_at ?? row.reviewed_at ?? row.declared_at),
    row_version: int(row.row_version, 1),
  };
}

function buildSubscriptionPeriods(platformPayments, subscriptionsById, plansById) {
  const periods = [];
  const coveredSubscriptionIds = new Set();

  for (const payment of platformPayments) {
    if (payment.status !== "validated" || !payment.subscription_id || !payment.plan_id) continue;
    const start = dateOnly(payment.access_period_start);
    const end = dateOnly(payment.access_period_end);
    if (!start || !end) continue;
    periods.push({
      id: crypto.randomUUID(),
      subscription_id: uuid(payment.subscription_id),
      workshop_id: uuid(payment.workshop_id),
      plan_id: uuid(payment.plan_id),
      source_payment_id: uuid(payment.id),
      period_start: start,
      period_end: end,
      status: periodStatus(start, end),
      created_at: timestamp(payment.reviewed_at ?? payment.declared_at),
      updated_at: timestamp(payment.reviewed_at ?? payment.declared_at),
      row_version: 1,
    });
    coveredSubscriptionIds.add(String(payment.subscription_id));
  }

  for (const subscription of subscriptionsById.values()) {
    if (coveredSubscriptionIds.has(String(subscription.id))) continue;
    if (!subscription.plan_id || !subscription.current_period_end) continue;
    const created = dateOnly(subscription.created_at) ?? today();
    const end = dateOnly(subscription.current_period_end);
    periods.push({
      id: crypto.randomUUID(),
      subscription_id: uuid(subscription.id),
      workshop_id: uuid(subscription.workshop_id),
      plan_id: uuid(subscription.plan_id),
      source_payment_id: null,
      period_start: created < end ? created : today(),
      period_end: end,
      status: periodStatus(created, end),
      created_at: timestamp(subscription.created_at),
      updated_at: timestamp(subscription.updated_at),
      row_version: int(subscription.row_version, 1),
    });
  }

  return periods.filter((period) => period.period_start < period.period_end);
}

function mapContent(row) {
  return {
    id: uuid(row.id),
    kind: mapContentKind(row.kind),
    slug: requiredText(row.slug, "Slug contenu manquant"),
    locale: requiredText(row.locale ?? "fr", "Locale contenu manquante"),
    title: requiredText(row.title, "Titre contenu manquant"),
    body_json: json(row.body_json, {}),
    published_at: nullableTimestamp(row.published_at),
    created_at: timestamp(row.created_at),
    updated_at: timestamp(row.updated_at),
    row_version: int(row.row_version, 1),
  };
}

function mapTicket(row) {
  const requesterName = row.requester_name ?? row.name ?? "Demandeur";
  const requesterContact = row.requester_contact ?? row.phone ?? row.email ?? null;
  return {
    id: uuid(row.id),
    workshop_id: nullableUuid(row.workshop_id),
    requester_user_id: nullableUserUuid(row.requester_user_id),
    requester_name: nullableText(requesterName),
    requester_contact: nullableText(requesterContact),
    assignee_user_id: nullableUserUuid(row.assignee_user_id),
    name: requiredText(row.name ?? requesterName, "Nom ticket manquant"),
    email: nullableText(row.email),
    phone: nullableText(row.phone),
    subject: requiredText(row.subject, "Sujet ticket manquant"),
    category: nullableText(row.category),
    message: requiredText(row.message ?? row.body, "Message ticket manquant"),
    body: nullableText(row.body ?? row.message),
    status: mapTicketStatus(row.status),
    created_at: timestamp(row.created_at),
    updated_at: timestamp(row.updated_at),
    row_version: int(row.row_version, 1),
  };
}

function mapAuditLog(row) {
  return {
    id: uuid(row.id),
    workshop_id: nullableUuid(row.workshop_id),
    actor_user_id: nullableUserUuid(row.actor_user_id),
    action: requiredText(row.action, "Action audit manquante"),
    entity_kind: requiredText(row.entity_kind, "Entite audit manquante"),
    entity_id: nullableUuid(row.entity_id),
    reason: nullableText(row.reason),
    before_json: nullableJson(row.before_json),
    after_json: nullableJson(row.after_json),
    ip_address: nullableText(row.ip_address),
    created_at: timestamp(row.created_at),
  };
}

function printPlan(rows) {
  console.log("Migration planifiee MongoDB -> Postgres:");
  for (const table of migrationOrder()) {
    console.log(`${table.padEnd(28)} ${String(rows[table].length).padStart(5)}`);
  }
}

function mapUserStatus(value) {
  return value === "disabled" ? "disabled" : "active";
}

function mapWorkshopStatus(value) {
  if (["suspended", "closed"].includes(value)) return value;
  return "active";
}

function mapMemberRole(value) {
  if (value === "owner") return "owner";
  if (value === "manager" || value === "responsable") return "manager";
  return "collaborator";
}

function mapMemberStatus(value) {
  if (["invited", "disabled", "removed"].includes(value)) return value;
  return "active";
}

function mapSubscriptionStatus(value) {
  if (value === "trial" || value === "trialing") return "trialing";
  if (value === "renewal_due" || value === "past_due" || value === "suspended") return "past_due";
  if (value === "cancelled") return "cancelled";
  if (value === "expired") return "expired";
  return "active";
}

function mapOrderItemStatus(value) {
  const map = {
    a_realiser: "todo",
    todo: "todo",
    pret: "ready",
    ready: "ready",
    en_cours: "in_progress",
    in_progress: "in_progress",
    essayage: "fitting",
    fitting: "fitting",
    livre: "delivered",
    delivered: "delivered",
    annule: "cancelled",
    cancelled: "cancelled",
  };
  return map[value] ?? "todo";
}

function mapWorkType(value) {
  return value === "retouche" ? "retouche" : "creation";
}

function mapMovementKind(value) {
  if (["refund", "correction"].includes(value)) return value;
  return "payment";
}

function mapMovementMethod(value) {
  if (["cash", "mobile_money", "bank_transfer", "card", "other"].includes(value)) return value;
  if (value === "transfer") return "bank_transfer";
  if (value === "airtel_money" || value === "mtn_momo") return "mobile_money";
  return "other";
}

function mapMovementStatus(value) {
  return value === "voided" ? "voided" : "confirmed";
}

function mapPlatformPaymentStatus(value) {
  if (["declared", "provider_pending", "validated", "rejected", "failed", "cancelled"].includes(value)) return value;
  return "declared";
}

function mapContentKind(value) {
  if (["faq", "guide"].includes(value)) return value;
  return "page";
}

function mapTicketStatus(value) {
  if (value === "in_progress" || value === "resolved") return value;
  return "open";
}

function periodStatus(start, end) {
  const now = today();
  if (end <= now) return "consumed";
  if (start > now) return "scheduled";
  return "active";
}

function uuid(value) {
  const text = requiredText(value, "UUID manquant");
  return toPgUuid(text);
}

function nullableUuid(value) {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value);
  return toPgUuid(text);
}

function nullableUserUuid(value) {
  const id = nullableUuid(value);
  return id && knownUserIds.has(id) ? id : null;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function toPgUuid(value) {
  if (isUuid(value)) return value;
  const hex = createHash("sha256").update(`fileo:${value}`).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20, 32).join("")}`;
}

function requiredText(value, message) {
  const text = nullableText(value);
  if (!text) throw new Error(message);
  return text;
}

function nullableText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function slug(value) {
  return requiredText(value, "Slug manquant")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function bool(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function int(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

function nullableInt(value) {
  if (value === null || value === undefined || value === "") return null;
  return int(value, 0);
}

function timestamp(value) {
  if (!value) return new Date().toISOString();
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function nullableTimestamp(value) {
  if (!value) return null;
  return timestamp(value);
}

function dateOnly(value) {
  if (!value) return null;
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function requiredDate(value, message) {
  const date = dateOnly(value);
  if (!date) throw new Error(message);
  return date;
}

function json(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function nullableJson(value) {
  if (value === null || value === undefined || value === "") return null;
  return json(value, null);
}

function toTextArray(value) {
  const parsed = json(value, []);
  return Array.isArray(parsed) ? parsed.map(String) : [];
}

function quoteIdent(identifier) {
  return `"${String(identifier).replaceAll('"', '""')}"`;
}

function serializePgValue(value) {
  if (value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
    return JSON.stringify(value);
  }
  return value;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
