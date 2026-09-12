import "server-only";

import type { ClientSession } from "mongodb";
import { collection, newId, nowIso } from "./db";

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
  | "measurement.create"
  | "order.create"
  | "order.update"
  | "order.cancel"
  | "order.date_change"
  | "order.price_change"
  | "item.status_change"
  | "item.update"
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
};

export async function recordAudit(
  entry: AuditEntry,
  session?: ClientSession,
): Promise<void> {
  const audit = await collection("audit_log");
  await audit.insertOne({
    id: newId(),
    workshop_id: entry.workshopId ?? null,
    actor_user_id: entry.actorUserId ?? null,
    action: entry.action,
    entity_kind: entry.entityKind,
    entity_id: entry.entityId ?? null,
    reason: entry.reason ?? null,
    before_json: entry.before === undefined ? null : JSON.stringify(entry.before),
    after_json: entry.after === undefined ? null : JSON.stringify(entry.after),
    ip_address: entry.ipAddress ?? null,
    created_at: nowIso(),
  }, { session });
}
