import "server-only";

import { recordAudit } from "@/lib/audit";
import { collection, newId, nowIso, withTransaction } from "@/lib/db";
import { money, type CurrencyCode, type Money } from "@/lib/money";
import { getOrderBalance } from "./orders";

export type MovementKind = "payment" | "refund" | "correction";
export type MovementMethod = "cash" | "mobile_money" | "transfer" | "other";
export const METHOD_LABELS: Record<MovementMethod, string> = {
  cash: "Espèces", mobile_money: "Mobile money", transfer: "Virement", other: "Autre",
};
export type MovementRow = {
  id: string; order_id: string; kind: string; amount: number; currency: string;
  method: string; reference: string | null; effective_date: string; status: string;
  reverses_id: string | null; void_reason: string | null; created_by: string; created_at: string;
};
export class FinancialError extends Error {
  constructor(message: string) { super(message); this.name = "FinancialError"; }
}
export type RecordPaymentInput = {
  workshopId: string; orderId: string; actorUserId: string; amount: Money;
  method: MovementMethod; reference?: string | null; effectiveDate: string;
  idempotencyKey: string; pending?: boolean;
};
export type RecordPaymentResult = { movementId: string; deduplicated: boolean };

export async function recordPayment(input: RecordPaymentInput): Promise<RecordPaymentResult> {
  if (input.amount.amount <= 0) throw new FinancialError("Le montant d'un encaissement doit être strictement positif.");
  return withTransaction(async (session) => {
    const orders = await collection("orders");
    const movements = await collection("financial_movements");
    const order = await orders.findOne(
      { id: input.orderId, workshop_id: input.workshopId },
      { projection: { currency: 1, cancelled_at: 1 }, session },
    );
    if (!order) throw new FinancialError("Commande introuvable dans cet atelier.");
    if (order.cancelled_at) throw new FinancialError("Aucun nouvel encaissement ne peut être ajouté à une commande annulée.");
    if (order.currency !== input.amount.currency) throw new FinancialError(`Devise incompatible : la commande est en ${order.currency}.`);

    const existing = await movements.findOne(
      { workshop_id: input.workshopId, idempotency_key: input.idempotencyKey },
      { session },
    );
    if (existing) {
      const sameOperation = existing.order_id === input.orderId && existing.kind === "payment" &&
        existing.amount === input.amount.amount && existing.currency === input.amount.currency &&
        existing.method === input.method && existing.reference === (input.reference ?? null) &&
        existing.effective_date === input.effectiveDate;
      if (!sameOperation) throw new FinancialError("Cette tentative d'encaissement a déjà été utilisée avec d'autres données.");
      return { movementId: String(existing.id), deduplicated: true };
    }

    const id = newId();
    await movements.insertOne({
      id, workshop_id: input.workshopId, order_id: input.orderId, kind: "payment",
      amount: input.amount.amount, currency: input.amount.currency, method: input.method,
      reference: input.reference ?? null, effective_date: input.effectiveDate,
      status: input.pending ? "pending" : "confirmed", reverses_id: null, void_reason: null,
      idempotency_key: input.idempotencyKey, created_by: input.actorUserId,
      created_at: nowIso(), row_version: 1,
    }, { session });
    await recordAudit({
      workshopId: input.workshopId, actorUserId: input.actorUserId,
      action: "payment.record", entityKind: "financial_movement", entityId: id,
      after: { orderId: input.orderId, amount: input.amount.amount, currency: input.amount.currency, method: input.method },
    }, session);
    return { movementId: id, deduplicated: false };
  });
}

export type RecordRefundInput = Omit<RecordPaymentInput, "pending"> & { reason: string };

export async function recordRefund(input: RecordRefundInput): Promise<RecordPaymentResult> {
  if (input.amount.amount <= 0) throw new FinancialError("Le montant d'un remboursement doit être strictement positif.");
  const balance = await getOrderBalance(input.orderId, input.amount.currency);
  if (input.amount.amount > balance.netCollected.amount) {
    throw new FinancialError("Le remboursement dépasse le montant disponible à rembourser sur cette commande.");
  }
  return withTransaction(async (session) => {
    const orders = await collection("orders");
    const movements = await collection("financial_movements");
    const order = await orders.findOne(
      { id: input.orderId, workshop_id: input.workshopId },
      { projection: { currency: 1 }, session },
    );
    if (!order) throw new FinancialError("Commande introuvable dans cet atelier.");
    const existing = await movements.findOne(
      { workshop_id: input.workshopId, idempotency_key: input.idempotencyKey }, { session },
    );
    if (existing) return { movementId: String(existing.id), deduplicated: true };
    const id = newId();
    await movements.insertOne({
      id, workshop_id: input.workshopId, order_id: input.orderId, kind: "refund",
      amount: input.amount.amount, currency: order.currency, method: input.method,
      reference: input.reference ?? null, effective_date: input.effectiveDate,
      status: "confirmed", reverses_id: null, void_reason: input.reason,
      idempotency_key: input.idempotencyKey, created_by: input.actorUserId,
      created_at: nowIso(), row_version: 1,
    }, { session });
    await recordAudit({
      workshopId: input.workshopId, actorUserId: input.actorUserId,
      action: "refund.record", entityKind: "financial_movement", entityId: id,
      reason: input.reason, after: { orderId: input.orderId, amount: input.amount.amount, currency: order.currency },
    }, session);
    return { movementId: id, deduplicated: false };
  });
}

export async function voidMovement(params: {
  workshopId: string; movementId: string; actorUserId: string; reason: string;
}): Promise<string> {
  if (!params.reason.trim()) throw new FinancialError("Un motif est obligatoire pour annuler un mouvement.");
  return withTransaction(async (session) => {
    const movements = await collection("financial_movements");
    const original = await movements.findOne(
      { id: params.movementId, workshop_id: params.workshopId }, { session },
    );
    if (!original) throw new FinancialError("Mouvement introuvable dans cet atelier.");
    if (original.status === "voided") throw new FinancialError("Ce mouvement est déjà annulé.");
    const counterId = newId();
    await movements.insertOne({
      id: counterId, workshop_id: params.workshopId, order_id: original.order_id,
      kind: "correction", amount: original.amount, currency: original.currency,
      method: original.method, reference: original.reference ?? null,
      effective_date: nowIso().slice(0, 10), status: "confirmed", reverses_id: original.id,
      void_reason: params.reason, idempotency_key: `void:${original.id}`,
      created_by: params.actorUserId, created_at: nowIso(), row_version: 1,
    }, { session });
    const result = await movements.updateOne(
      { id: params.movementId, workshop_id: params.workshopId, status: { $ne: "voided" } },
      { $set: { status: "voided", void_reason: params.reason }, $inc: { row_version: 1 } },
      { session },
    );
    if (result.modifiedCount !== 1) throw new FinancialError("Ce mouvement vient d'être annulé.");
    await recordAudit({
      workshopId: params.workshopId, actorUserId: params.actorUserId,
      action: "payment.void", entityKind: "financial_movement", entityId: String(original.id),
      reason: params.reason, before: { status: original.status, amount: original.amount },
      after: { status: "voided", counterEntry: counterId },
    }, session);
    return counterId;
  });
}

export async function listMovements(workshopId: string, orderId: string): Promise<MovementRow[]> {
  const movements = await collection("financial_movements");
  return movements.find(
    { workshop_id: workshopId, order_id: orderId }, { projection: { _id: 0 } },
  ).sort({ effective_date: -1, created_at: -1 }).toArray() as unknown as Promise<MovementRow[]>;
}

export async function listRecentMovements(workshopId: string, limit = 50) {
  const movements = await collection("financial_movements");
  return movements.aggregate<MovementRow & { reference_label: string; client_name: string }>([
    { $match: { workshop_id: workshopId } },
    { $sort: { effective_date: -1, created_at: -1 } }, { $limit: limit },
    { $lookup: { from: "orders", localField: "order_id", foreignField: "id", as: "order" } },
    { $unwind: "$order" },
    { $lookup: { from: "clients", localField: "order.client_id", foreignField: "id", as: "client" } },
    { $unwind: "$client" },
    { $set: { reference_label: "$order.reference", client_name: "$client.display_name" } },
    { $project: { _id: 0, order: 0, client: 0 } },
  ]).toArray();
}

export async function collectedBetween(
  workshopId: string, fromDate: string, toDate: string, currency: CurrencyCode,
): Promise<Money> {
  const movements = await collection("financial_movements");
  const [row] = await movements.aggregate<{ total: number }>([
    { $match: { workshop_id: workshopId, status: "confirmed", effective_date: { $gte: fromDate, $lte: toDate } } },
    { $group: { _id: null, total: { $sum: { $switch: { branches: [
      { case: { $eq: ["$kind", "payment"] }, then: "$amount" },
      { case: { $eq: ["$kind", "refund"] }, then: { $multiply: ["$amount", -1] } },
    ], default: 0 } } } } },
  ]).toArray();
  return money(row?.total ?? 0, currency);
}
