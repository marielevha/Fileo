import "server-only";

import { randomUUID } from "node:crypto";
import { sql, type PgExecutor } from "@/lib/supabase/postgres";

/**
 * Audit trail — §17.1.
 *
 * Records who changed what, when and why, with before/after values for
 * sensitive actions (§12.2). Never log passwords, tokens, measurements or
 * photos (§17.1): pass only the fields that matter to the decision.
 */

export type AuditAction =
  | "auth.login"
  | "auth.logout"
  | "auth.register"
  | "user.update"
  | "workshop.create"
  | "workshop.update"
  | "workshop.suspend"
  | "member.invite"
  | "member.disable"
  | "member.permissions"
  | "client.create"
  | "client.update"
  | "client.archive"
  | "client.delete"
  | "client.resolve"
  | "measurement.create"
  | "order.create"
  | "order.update"
  | "order.cancel"
  | "order.resolve"
  | "order.close"
  | "order.date_change"
  | "order.price_change"
  | "item.status_change"
  | "item.update"
  | "item.resolve"
  | "payment.record"
  | "payment.void"
  | "refund.record"
  | "expense.record"
  | "export.run"
  | "plan.create"
  | "plan.archive"
  | "subscription.update"
  | "platform_payment.declare"
  | "platform_payment.validate"
  | "platform_payment.reject"
  | "content.publish"
  | "content.update"
  | "template.update"
  | "template.delete"
  | "platform_support.update"
  | "ticket.update";

export type AuditEntry = {
  workshopId?: string | null;
  actorUserId?: string | null;
  action: AuditAction;
  entityKind: string;
  entityId?: string | null;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
  mobileOperationId?: string | null;
};

export async function recordAudit(
  entry: AuditEntry,
  executor?: PgExecutor,
): Promise<void> {
  await sql(`insert into public.audit_log
    (id, workshop_id, actor_user_id, action, entity_kind, entity_id, reason, before_json, after_json, ip_address, mobile_operation_id)
    values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10::inet,$11::uuid)`, [
    randomUUID(), entry.workshopId ?? null, entry.actorUserId ?? null, entry.action,
    entry.entityKind, entry.entityId ?? null, entry.reason ?? null,
    entry.before === undefined ? null : JSON.stringify(entry.before),
    entry.after === undefined ? null : JSON.stringify(entry.after),
    entry.ipAddress ?? null, entry.mobileOperationId ?? null,
  ], executor);
}
