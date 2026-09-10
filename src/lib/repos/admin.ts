import "server-only";

import { execute, newId, nowIso, query, queryOne, transaction } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { money, type CurrencyCode, type Money } from "@/lib/money";

/**
 * Back-office reads and the subscription-validation write (§12).
 *
 * §12.1 is explicit that Filéo revenue must never mix with the payments a
 * tailor collects from their own clients: these queries only ever touch
 * `platform_payments`, never `financial_movements`.
 */

export type AdminCounts = {
  workshops: number;
  activeWorkshops: number;
  trials: number;
  payingWorkshops: number;
  expiringSoon: number;
  openTickets: number;
  pendingPayments: number;
};

export function getAdminCounts(): AdminCounts {
  const soon = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const row = queryOne<AdminCounts>(
    `SELECT
       (SELECT COUNT(*) FROM workshops) AS workshops,
       (SELECT COUNT(*) FROM workshops WHERE status = 'active') AS activeWorkshops,
       (SELECT COUNT(*) FROM subscriptions WHERE status = 'trial') AS trials,
       (SELECT COUNT(*) FROM subscriptions WHERE status = 'active') AS payingWorkshops,
       (SELECT COUNT(*) FROM subscriptions
         WHERE status IN ('trial','active','renewal_due')
           AND current_period_end BETWEEN ? AND ?) AS expiringSoon,
       (SELECT COUNT(*) FROM tickets WHERE status <> 'resolved') AS openTickets,
       (SELECT COUNT(*) FROM platform_payments WHERE status = 'declared') AS pendingPayments`,
    [today, soon],
  );

  return (
    row ?? {
      workshops: 0,
      activeWorkshops: 0,
      trials: 0,
      payingWorkshops: 0,
      expiringSoon: 0,
      openTickets: 0,
      pendingPayments: 0,
    }
  );
}

/** Validated Filéo revenue, split by currency — §12.1 forbids mixing them. */
export function getRevenueByCurrency(): Money[] {
  const rows = query<{ currency: string; total: number }>(
    `SELECT currency, SUM(amount) AS total
       FROM platform_payments
      WHERE status = 'validated'
      GROUP BY currency
      ORDER BY currency`,
    [],
  );

  return rows.map((row) => money(row.total, row.currency as CurrencyCode));
}

export type WorkshopAdminRow = {
  id: string;
  name: string;
  country_code: string;
  city: string | null;
  currency: string;
  status: string;
  created_at: string;
  owner_name: string;
  member_count: number;
  subscription_status: string | null;
  current_period_end: string | null;
};

export function listWorkshops(search = ""): WorkshopAdminRow[] {
  return query<WorkshopAdminRow>(
    `SELECT w.id, w.name, w.country_code, w.city, w.currency, w.status, w.created_at,
            u.full_name AS owner_name,
            (SELECT COUNT(*) FROM memberships m
              WHERE m.workshop_id = w.id AND m.status = 'active') AS member_count,
            s.status AS subscription_status,
            s.current_period_end
       FROM workshops w
       JOIN users u ON u.id = w.owner_user_id
       LEFT JOIN subscriptions s ON s.workshop_id = w.id
      WHERE ? = '' OR LOWER(w.name) LIKE '%' || LOWER(?) || '%'
      ORDER BY w.created_at DESC
      LIMIT 200`,
    [search, search],
  );
}

export type PlatformPaymentRow = {
  id: string;
  workshop_id: string;
  workshop_name: string;
  subscription_id: string;
  amount: number;
  currency: string;
  channel: string;
  external_reference: string | null;
  status: string;
  declared_at: string;
  review_note: string | null;
};

export function listPlatformPayments(status?: string): PlatformPaymentRow[] {
  return query<PlatformPaymentRow>(
    `SELECT p.*, w.name AS workshop_name
       FROM platform_payments p
       JOIN workshops w ON w.id = p.workshop_id
      WHERE (? IS NULL OR p.status = ?)
      ORDER BY p.declared_at DESC
      LIMIT 200`,
    [status ?? null, status ?? null],
  );
}

/**
 * Validates an external subscription payment and extends the period (§11.3).
 *
 * §11.2: a renewal arriving before expiry extends the existing end date;
 * after expiry it restarts from today. REC-17 requires that validating the
 * same reference twice activates the subscription only once.
 */
export function validatePlatformPayment(params: {
  paymentId: string;
  reviewerUserId: string;
  note?: string | null;
}): { alreadyValidated: boolean } {
  return transaction(() => {
    const payment = queryOne<{
      id: string;
      status: string;
      subscription_id: string;
      workshop_id: string;
      amount: number;
      currency: string;
    }>(`SELECT * FROM platform_payments WHERE id = ?`, [params.paymentId]);

    if (!payment) throw new Error("Règlement introuvable.");
    if (payment.status === "validated") return { alreadyValidated: true };

    const subscription = queryOne<{
      id: string;
      current_period_end: string | null;
      plan_id: string;
    }>(`SELECT id, current_period_end, plan_id FROM subscriptions WHERE id = ?`, [
      payment.subscription_id,
    ]);

    if (!subscription) throw new Error("Abonnement introuvable.");

    const plan = queryOne<{ period_months: number }>(
      `SELECT period_months FROM plans WHERE id = ?`,
      [subscription.plan_id],
    );

    const months = plan?.period_months ?? 1;
    const today = new Date();
    const currentEnd = subscription.current_period_end
      ? new Date(`${subscription.current_period_end}T00:00:00`)
      : null;

    // Extend from the existing end when still valid, otherwise from today.
    const base = currentEnd && currentEnd > today ? currentEnd : today;
    const nextEnd = new Date(base);
    nextEnd.setMonth(nextEnd.getMonth() + months);

    execute(
      `UPDATE platform_payments
          SET status = 'validated', reviewed_at = ?, reviewed_by = ?, review_note = ?
        WHERE id = ?`,
      [nowIso(), params.reviewerUserId, params.note ?? null, payment.id],
    );

    execute(
      `UPDATE subscriptions
          SET status = 'active', current_period_end = ?, grace_ends_at = NULL,
              updated_at = ?, row_version = row_version + 1
        WHERE id = ?`,
      [nextEnd.toISOString().slice(0, 10), nowIso(), subscription.id],
    );

    recordAudit({
      workshopId: payment.workshop_id,
      actorUserId: params.reviewerUserId,
      action: "platform_payment.validate",
      entityKind: "platform_payment",
      entityId: payment.id,
      reason: params.note ?? null,
      before: { subscriptionEnd: subscription.current_period_end },
      after: { subscriptionEnd: nextEnd.toISOString().slice(0, 10) },
    });

    return { alreadyValidated: false };
  });
}

export function rejectPlatformPayment(params: {
  paymentId: string;
  reviewerUserId: string;
  note: string;
}): void {
  execute(
    `UPDATE platform_payments
        SET status = 'rejected', reviewed_at = ?, reviewed_by = ?, review_note = ?
      WHERE id = ? AND status = 'declared'`,
    [nowIso(), params.reviewerUserId, params.note, params.paymentId],
  );

  recordAudit({
    actorUserId: params.reviewerUserId,
    action: "platform_payment.reject",
    entityKind: "platform_payment",
    entityId: params.paymentId,
    reason: params.note,
  });
}

export type AuditRow = {
  id: string;
  workshop_id: string | null;
  actor_name: string | null;
  action: string;
  entity_kind: string;
  entity_id: string | null;
  reason: string | null;
  created_at: string;
};

export function listAudit(limit = 100): AuditRow[] {
  return query<AuditRow>(
    `SELECT a.id, a.workshop_id, u.full_name AS actor_name, a.action,
            a.entity_kind, a.entity_id, a.reason, a.created_at
       FROM audit_log a
       LEFT JOIN users u ON u.id = a.actor_user_id
      ORDER BY a.created_at DESC
      LIMIT ?`,
    [limit],
  );
}

export type TicketRow = {
  id: string;
  workshop_id: string | null;
  workshop_name: string | null;
  requester_name: string | null;
  category: string;
  subject: string;
  status: string;
  created_at: string;
};

export function listTickets(status?: string): TicketRow[] {
  return query<TicketRow>(
    `SELECT t.id, t.workshop_id, w.name AS workshop_name, t.requester_name,
            t.category, t.subject, t.status, t.created_at
       FROM tickets t
       LEFT JOIN workshops w ON w.id = t.workshop_id
      WHERE (? IS NULL OR t.status = ?)
      ORDER BY t.created_at DESC
      LIMIT 200`,
    [status ?? null, status ?? null],
  );
}

/** Creates a support ticket from the public contact form (§13.3). */
export function createTicket(params: {
  workshopId?: string | null;
  requesterUserId?: string | null;
  requesterName: string;
  requesterContact: string;
  category: string;
  subject: string;
  body: string;
}): string {
  const id = newId();

  execute(
    `INSERT INTO tickets
       (id, workshop_id, requester_user_id, requester_name, requester_contact,
        category, subject, body, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
    [
      id,
      params.workshopId ?? null,
      params.requesterUserId ?? null,
      params.requesterName,
      params.requesterContact,
      params.category,
      params.subject,
      params.body,
      nowIso(),
      nowIso(),
    ],
  );

  return id;
}
