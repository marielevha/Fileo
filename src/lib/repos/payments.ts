import "server-only";

import { execute, newId, nowIso, query, queryOne, transaction } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { money, type CurrencyCode, type Money } from "@/lib/money";
import { getOrderBalance } from "./orders";

/**
 * Financial writes — cahier des charges §8.7.
 *
 * Three rules drive every function here:
 *   1. The ledger is append-only. A confirmed movement is never updated or
 *      deleted; it is neutralised by a counter-entry that carries a reason.
 *   2. Writes are idempotent. Replaying the same operation key must never
 *      produce a second movement (REC-04).
 *   3. Amounts are always strictly positive; direction comes from `kind`.
 */

export type MovementKind = "payment" | "refund" | "correction";
export type MovementMethod = "cash" | "mobile_money" | "transfer" | "other";

export const METHOD_LABELS: Record<MovementMethod, string> = {
  cash: "Espèces",
  mobile_money: "Mobile money",
  transfer: "Virement",
  other: "Autre",
};

export type MovementRow = {
  id: string;
  order_id: string;
  kind: string;
  amount: number;
  currency: string;
  method: string;
  reference: string | null;
  effective_date: string;
  status: string;
  reverses_id: string | null;
  void_reason: string | null;
  created_by: string;
  created_at: string;
};

export class FinancialError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FinancialError";
  }
}

export type RecordPaymentInput = {
  workshopId: string;
  orderId: string;
  actorUserId: string;
  amount: Money;
  method: MovementMethod;
  reference?: string | null;
  effectiveDate: string;
  /** Supplied by the client so a retry cannot double-post (§8.7, REC-04). */
  idempotencyKey: string;
  /** Offline entries stay `pending` until the server confirms them (§10.1). */
  pending?: boolean;
};

export type RecordPaymentResult = {
  movementId: string;
  /** True when an existing movement was returned instead of a new one. */
  deduplicated: boolean;
};

export function recordPayment(input: RecordPaymentInput): RecordPaymentResult {
  if (input.amount.amount <= 0) {
    throw new FinancialError("Le montant d'un encaissement doit être strictement positif.");
  }

  return transaction(() => {
    const order = queryOne<{ id: string; currency: string; cancelled_at: string | null }>(
      `SELECT id, currency, cancelled_at FROM orders WHERE id = ? AND workshop_id = ?`,
      [input.orderId, input.workshopId],
    );

    if (!order) throw new FinancialError("Commande introuvable dans cet atelier.");
    if (order.cancelled_at) {
      throw new FinancialError("Aucun nouvel encaissement ne peut être ajouté à une commande annulée.");
    }

    if (order.currency !== input.amount.currency) {
      throw new FinancialError(
        `Devise incompatible : la commande est en ${order.currency}.`,
      );
    }

    // Replay of an already-accepted operation: return the original.
    const existing = queryOne<{
      id: string;
      order_id: string;
      kind: string;
      amount: number;
      currency: string;
      method: string;
      reference: string | null;
      effective_date: string;
    }>(
      `SELECT id, order_id, kind, amount, currency, method, reference, effective_date
         FROM financial_movements
        WHERE workshop_id = ? AND idempotency_key = ?`,
      [input.workshopId, input.idempotencyKey],
    );

    if (existing) {
      const sameOperation =
        existing.order_id === input.orderId &&
        existing.kind === "payment" &&
        existing.amount === input.amount.amount &&
        existing.currency === input.amount.currency &&
        existing.method === input.method &&
        existing.reference === (input.reference ?? null) &&
        existing.effective_date === input.effectiveDate;
      if (!sameOperation) {
        throw new FinancialError("Cette tentative d'encaissement a déjà été utilisée avec d'autres données.");
      }
      return { movementId: existing.id, deduplicated: true };
    }

    const id = newId();

    execute(
      `INSERT INTO financial_movements
         (id, workshop_id, order_id, kind, amount, currency, method, reference,
          effective_date, status, idempotency_key, created_by, created_at)
       VALUES (?, ?, ?, 'payment', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.workshopId,
        input.orderId,
        input.amount.amount,
        input.amount.currency,
        input.method,
        input.reference ?? null,
        input.effectiveDate,
        input.pending ? "pending" : "confirmed",
        input.idempotencyKey,
        input.actorUserId,
        nowIso(),
      ],
    );

    recordAudit({
      workshopId: input.workshopId,
      actorUserId: input.actorUserId,
      action: "payment.record",
      entityKind: "financial_movement",
      entityId: id,
      after: {
        orderId: input.orderId,
        amount: input.amount.amount,
        currency: input.amount.currency,
        method: input.method,
      },
    });

    return { movementId: id, deduplicated: false };
  });
}

export type RecordRefundInput = Omit<RecordPaymentInput, "pending"> & {
  reason: string;
};

/**
 * A refund may not exceed what is actually available to refund (§8.7):
 * confirmed payments minus refunds already issued.
 */
export function recordRefund(input: RecordRefundInput): RecordPaymentResult {
  if (input.amount.amount <= 0) {
    throw new FinancialError("Le montant d'un remboursement doit être strictement positif.");
  }

  return transaction(() => {
    const order = queryOne<{ currency: string }>(
      `SELECT currency FROM orders WHERE id = ? AND workshop_id = ?`,
      [input.orderId, input.workshopId],
    );

    if (!order) throw new FinancialError("Commande introuvable dans cet atelier.");

    const existing = queryOne<{ id: string }>(
      `SELECT id FROM financial_movements WHERE workshop_id = ? AND idempotency_key = ?`,
      [input.workshopId, input.idempotencyKey],
    );

    if (existing) return { movementId: existing.id, deduplicated: true };

    const currency = order.currency as CurrencyCode;
    const balance = getOrderBalance(input.orderId, currency);

    if (input.amount.amount > balance.netCollected.amount) {
      throw new FinancialError(
        "Le remboursement dépasse le montant disponible à rembourser sur cette commande.",
      );
    }

    const id = newId();

    execute(
      `INSERT INTO financial_movements
         (id, workshop_id, order_id, kind, amount, currency, method, reference,
          effective_date, status, void_reason, idempotency_key, created_by, created_at)
       VALUES (?, ?, ?, 'refund', ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?)`,
      [
        id,
        input.workshopId,
        input.orderId,
        input.amount.amount,
        currency,
        input.method,
        input.reference ?? null,
        input.effectiveDate,
        input.reason,
        input.idempotencyKey,
        input.actorUserId,
        nowIso(),
      ],
    );

    recordAudit({
      workshopId: input.workshopId,
      actorUserId: input.actorUserId,
      action: "refund.record",
      entityKind: "financial_movement",
      entityId: id,
      reason: input.reason,
      after: { orderId: input.orderId, amount: input.amount.amount, currency },
    });

    return { movementId: id, deduplicated: false };
  });
}

/**
 * Neutralises a confirmed movement with a counter-entry (§8.7: "pas de
 * modification destructive"). The original row keeps its values and its place
 * in the history; only its status changes to `voided`.
 */
export function voidMovement(params: {
  workshopId: string;
  movementId: string;
  actorUserId: string;
  reason: string;
}): string {
  if (!params.reason.trim()) {
    throw new FinancialError("Un motif est obligatoire pour annuler un mouvement.");
  }

  return transaction(() => {
    const original = queryOne<MovementRow>(
      `SELECT * FROM financial_movements WHERE id = ? AND workshop_id = ?`,
      [params.movementId, params.workshopId],
    );

    if (!original) throw new FinancialError("Mouvement introuvable dans cet atelier.");
    if (original.status === "voided") throw new FinancialError("Ce mouvement est déjà annulé.");

    const counterId = newId();

    execute(
      `INSERT INTO financial_movements
         (id, workshop_id, order_id, kind, amount, currency, method, reference,
          effective_date, status, reverses_id, void_reason, idempotency_key,
          created_by, created_at)
       VALUES (?, ?, ?, 'correction', ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?, ?)`,
      [
        counterId,
        params.workshopId,
        original.order_id,
        original.amount,
        original.currency,
        original.method,
        original.reference,
        nowIso().slice(0, 10),
        original.id,
        params.reason,
        `void:${original.id}`,
        params.actorUserId,
        nowIso(),
      ],
    );

    execute(
      `UPDATE financial_movements
          SET status = 'voided', void_reason = ?, row_version = row_version + 1
        WHERE id = ?`,
      [params.reason, original.id],
    );

    recordAudit({
      workshopId: params.workshopId,
      actorUserId: params.actorUserId,
      action: "payment.void",
      entityKind: "financial_movement",
      entityId: original.id,
      reason: params.reason,
      before: { status: original.status, amount: original.amount },
      after: { status: "voided", counterEntry: counterId },
    });

    return counterId;
  });
}

export function listMovements(workshopId: string, orderId: string): MovementRow[] {
  return query<MovementRow>(
    `SELECT * FROM financial_movements
      WHERE workshop_id = ? AND order_id = ?
      ORDER BY effective_date DESC, created_at DESC`,
    [workshopId, orderId],
  );
}

export function listRecentMovements(workshopId: string, limit = 50) {
  return query<MovementRow & { reference_label: string; client_name: string }>(
    `SELECT m.*, o.reference AS reference_label, c.display_name AS client_name
       FROM financial_movements m
       JOIN orders o ON o.id = m.order_id
       JOIN clients c ON c.id = o.client_id
      WHERE m.workshop_id = ?
      ORDER BY m.effective_date DESC, m.created_at DESC
      LIMIT ?`,
    [workshopId, limit],
  );
}

/** Sum of confirmed payments minus refunds over a period, for the dashboard. */
export function collectedBetween(
  workshopId: string,
  fromDate: string,
  toDate: string,
  currency: CurrencyCode,
): Money {
  const row = queryOne<{ total: number | null }>(
    `SELECT COALESCE(SUM(CASE WHEN kind = 'payment' THEN amount
                              WHEN kind = 'refund'  THEN -amount
                              ELSE 0 END), 0) AS total
       FROM financial_movements
      WHERE workshop_id = ?
        AND status = 'confirmed'
        AND effective_date BETWEEN ? AND ?`,
    [workshopId, fromDate, toDate],
  );

  return money(row?.total ?? 0, currency);
}
