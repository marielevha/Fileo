import "server-only";

import { execute, newId, nowIso } from "./db";

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

export function recordAudit(entry: AuditEntry): void {
  execute(
    `INSERT INTO audit_log
       (id, workshop_id, actor_user_id, action, entity_kind, entity_id,
        reason, before_json, after_json, ip_address, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId(),
      entry.workshopId ?? null,
      entry.actorUserId ?? null,
      entry.action,
      entry.entityKind,
      entry.entityId ?? null,
      entry.reason ?? null,
      entry.before === undefined ? null : JSON.stringify(entry.before),
      entry.after === undefined ? null : JSON.stringify(entry.after),
      entry.ipAddress ?? null,
      nowIso(),
    ],
  );
}
