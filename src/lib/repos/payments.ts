import "server-only";

import { recordAudit } from "@/lib/audit";
import { collection, newId, nowIso, withTransaction } from "@/lib/db";
import {
  computeOrderBalance,
  money,
  multiply,
  type CurrencyCode,
  type Money,
} from "@/lib/money";
import {
  deriveOrderState,
  getOrderBalance,
  isOrderLate,
  type OrderItemRow,
  type OrderRow,
  type OrderState,
} from "./orders";

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

export type PaymentOrderFilter =
  | "all"
  | "a_encaisser"
  | "acompte"
  | "payes"
  | "sans_paiement"
  | "retard"
  | "trop_percu";

export type PaymentOrderRow = {
  order: OrderRow;
  state: OrderState;
  orderTotal: Money;
  netCollected: Money;
  remainingDue: Money;
  overpayment: Money;
  lastPaymentDate: string | null;
  movementCount: number;
  isLate: boolean;
};

export type PaymentOrderStats = {
  totalOrders: number;
  ordersWithRemainingDue: number;
  paidOrders: number;
  overdueOrders: number;
  overpaidOrders: number;
  totalRemainingDue: Money;
  totalCollected: Money;
  todayCollected: Money;
};

export type PaymentOrderPage = {
  items: PaymentOrderRow[];
  stats: PaymentOrderStats;
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

type RawPaymentOrder = OrderRow & {
  items: OrderItemRow[];
  movements: Array<{
    kind: string;
    amount: number;
    status: string;
    effective_date: string;
  }>;
  client_name: string;
};

export async function listPaymentOrders(
  workshopId: string,
  options: {
    search?: string;
    filter?: PaymentOrderFilter;
    page?: number;
    pageSize?: number;
    today?: string;
    currency: CurrencyCode;
  },
): Promise<PaymentOrderPage> {
  const orders = await collection("orders");
  const search = options.search?.trim().toLowerCase() ?? "";
  const today = options.today ?? nowIso().slice(0, 10);
  const pageSize = Math.min(50, Math.max(1, Math.trunc(options.pageSize ?? 10)));

  const rawRows = await orders.aggregate<RawPaymentOrder>([
    { $match: { workshop_id: workshopId } },
    { $lookup: { from: "clients", localField: "client_id", foreignField: "id", as: "client" } },
    { $unwind: { path: "$client", preserveNullAndEmptyArrays: true } },
    { $lookup: { from: "order_items", localField: "id", foreignField: "order_id", as: "items" } },
    { $lookup: { from: "financial_movements", localField: "id", foreignField: "order_id", as: "movements" } },
    { $set: { client_name: { $ifNull: ["$client.display_name", "Client supprimé"] } } },
    { $project: { _id: 0, client: 0 } },
    { $sort: { created_at: -1, id: -1 } },
  ]).toArray();

  const rows = rawRows
    .map((row) => buildPaymentOrderRow(row, options.currency, today))
    .filter((row) => matchesPaymentSearch(row, search))
    .filter((row) => matchesPaymentFilter(row, options.filter ?? "all"));

  const statsRows = rawRows.map((row) => buildPaymentOrderRow(row, options.currency, today));
  const stats = buildPaymentStats(statsRows, rawRows, options.currency, today);
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(pageCount, Math.max(1, Math.trunc(options.page ?? 1)));

  return {
    items: rows.slice((page - 1) * pageSize, page * pageSize),
    stats,
    total: rows.length,
    page,
    pageSize,
    pageCount,
  };
}

function buildPaymentOrderRow(row: RawPaymentOrder, currency: CurrencyCode, today: string): PaymentOrderRow {
  const items = row.items;
  const confirmed = row.movements.filter((movement) => movement.status === "confirmed");
  const balance = computeOrderBalance({
    currency,
    lineTotals: items
      .filter((item) => item.status !== "annule")
      .map((item) => multiply(money(Number(item.unit_price_amount), currency), Number(item.quantity))),
    discount: money(Number(row.discount_amount ?? 0), currency),
    confirmedPayments: confirmed
      .filter((movement) => movement.kind === "payment")
      .map((movement) => money(Number(movement.amount), currency)),
    confirmedRefunds: confirmed
      .filter((movement) => movement.kind === "refund")
      .map((movement) => money(Number(movement.amount), currency)),
  });
  const order: OrderRow = {
    id: row.id,
    workshop_id: row.workshop_id,
    client_id: row.client_id,
    client_name: row.client_name,
    reference: row.reference,
    currency: row.currency,
    discount_amount: Number(row.discount_amount ?? 0),
    discount_reason: row.discount_reason ?? null,
    instructions: row.instructions ?? null,
    promised_date: row.promised_date ?? null,
    fitting_date: row.fitting_date ?? null,
    cancelled_at: row.cancelled_at ?? null,
    created_at: row.created_at,
  };
  const paymentDates = confirmed
    .filter((movement) => movement.kind === "payment")
    .map((movement) => movement.effective_date)
    .sort((a, b) => b.localeCompare(a));

  return {
    order,
    state: deriveOrderState(order, items),
    orderTotal: balance.orderTotal,
    netCollected: balance.netCollected,
    remainingDue: balance.remainingDue,
    overpayment: balance.overpayment,
    lastPaymentDate: paymentDates[0] ?? null,
    movementCount: row.movements.filter((movement) => movement.kind !== "correction").length,
    isLate: balance.remainingDue.amount > 0 && isOrderLate(order, items, new Date(`${today}T12:00:00Z`)),
  };
}

function matchesPaymentSearch(row: PaymentOrderRow, search: string): boolean {
  if (!search) return true;
  return `${row.order.reference} ${row.order.client_name}`.toLowerCase().includes(search);
}

function matchesPaymentFilter(row: PaymentOrderRow, filter: PaymentOrderFilter): boolean {
  if (filter === "a_encaisser") return row.remainingDue.amount > 0;
  if (filter === "acompte") return row.netCollected.amount > 0 && row.remainingDue.amount > 0;
  if (filter === "payes") return row.remainingDue.amount === 0 && row.overpayment.amount === 0;
  if (filter === "sans_paiement") return row.netCollected.amount === 0;
  if (filter === "retard") return row.isLate;
  if (filter === "trop_percu") return row.overpayment.amount > 0;
  return true;
}

function buildPaymentStats(
  rows: PaymentOrderRow[],
  rawRows: RawPaymentOrder[],
  currency: CurrencyCode,
  today: string,
): PaymentOrderStats {
  const todayCollected = rawRows.reduce((total, row) => {
    return total + row.movements.reduce((subtotal, movement) => {
      if (movement.status !== "confirmed" || movement.effective_date !== today) return subtotal;
      if (movement.kind === "payment") return subtotal + Number(movement.amount);
      if (movement.kind === "refund") return subtotal - Number(movement.amount);
      return subtotal;
    }, 0);
  }, 0);

  return rows.reduce<PaymentOrderStats>((stats, row) => {
    stats.totalOrders += 1;
    stats.ordersWithRemainingDue += row.remainingDue.amount > 0 ? 1 : 0;
    stats.paidOrders += row.remainingDue.amount === 0 && row.overpayment.amount === 0 ? 1 : 0;
    stats.overdueOrders += row.isLate ? 1 : 0;
    stats.overpaidOrders += row.overpayment.amount > 0 ? 1 : 0;
    stats.totalRemainingDue.amount += row.remainingDue.amount;
    stats.totalCollected.amount += row.netCollected.amount;
    return stats;
  }, {
    totalOrders: 0,
    ordersWithRemainingDue: 0,
    paidOrders: 0,
    overdueOrders: 0,
    overpaidOrders: 0,
    totalRemainingDue: money(0, currency),
    totalCollected: money(0, currency),
    todayCollected: money(todayCollected, currency),
  });
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
