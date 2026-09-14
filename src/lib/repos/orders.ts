import "server-only";

import type { ClientSession } from "mongodb";
import { recordAudit } from "@/lib/audit";
import { collection, newId, nowIso, withTransaction } from "@/lib/db";
import {
  computeOrderBalance,
  money,
  multiply,
  type CurrencyCode,
  type Money,
  type OrderBalance,
} from "@/lib/money";

export const ITEM_STATUSES = [
  "a_realiser", "en_cours", "a_essayer", "pret", "remis", "annule",
] as const;

export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  a_realiser: "À réaliser",
  en_cours: "En cours",
  a_essayer: "À essayer",
  pret: "Prêt",
  remis: "Remis",
  annule: "Annulé",
};

export type OrderState =
  | "nouvelle" | "en_cours" | "prete" | "partiellement_remise" | "remise" | "annulee";

export const ORDER_STATE_LABELS: Record<OrderState, string> = {
  nouvelle: "Nouvelle",
  en_cours: "En cours",
  prete: "Prête",
  partiellement_remise: "Partiellement remise",
  remise: "Remise",
  annulee: "Annulée",
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  category: string;
  description: string;
  work_type?: string | null;
  wearer_name: string | null;
  wearer_relation: string | null;
  quantity: number;
  unit_price_amount: number;
  currency: string;
  status: string;
  due_date: string | null;
  delivered_quantity: number;
  assignee_user_id: string | null;
  measurement_snapshot: string | null;
};

export type OrderRow = {
  id: string;
  workshop_id: string;
  client_id: string;
  client_name: string;
  reference: string;
  currency: string;
  discount_amount: number;
  discount_reason: string | null;
  instructions: string | null;
  promised_date: string | null;
  fitting_date: string | null;
  cancelled_at: string | null;
  created_at: string;
};

export type OrderSummary = {
  order: OrderRow;
  items: OrderItemRow[];
  state: OrderState;
  balance: OrderBalance | null;
  isLate: boolean;
};

export type OrderPage = {
  items: OrderSummary[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type InitialPaymentMethod = "cash" | "mobile_money" | "transfer" | "other";
export type OrderItemWorkType = "creation" | "retouche";

export type CreateOrderItemInput = {
  category: string;
  description: string;
  workType: OrderItemWorkType;
  wearerName?: string | null;
  wearerRelation?: string | null;
  quantity: number;
  unitPrice: Money;
  dueDate?: string | null;
  assigneeUserId?: string | null;
  measurementValues?: Record<string, string>;
  measurementNotes?: string | null;
};

export type CreateOrderInput = {
  workshopId: string;
  actorUserId: string;
  clientId: string;
  currency: CurrencyCode;
  discount: Money;
  discountReason?: string | null;
  instructions?: string | null;
  promisedDate?: string | null;
  fittingDate?: string | null;
  items: CreateOrderItemInput[];
  initialPayment?: {
    amount: Money;
    method: InitialPaymentMethod;
    reference?: string | null;
    effectiveDate: string;
    idempotencyKey: string;
  } | null;
};

export type CreateOrderResult = {
  orderId: string;
  reference: string;
};

export class OrderWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderWriteError";
  }
}

export function deriveOrderState(order: OrderRow, items: OrderItemRow[]): OrderState {
  if (order.cancelled_at) return "annulee";
  const live = items.filter((item) => item.status !== "annule");
  if (live.length === 0) return items.length > 0 ? "annulee" : "nouvelle";
  const delivered = live.filter((item) => item.status === "remis");
  if (delivered.length === live.length) return "remise";
  if (delivered.length > 0) return "partiellement_remise";
  if (live.every((item) => item.status === "pret")) return "prete";
  if (live.some((item) => item.status !== "a_realiser")) return "en_cours";
  return "nouvelle";
}

export function isOrderLate(order: OrderRow, items: OrderItemRow[], today = new Date()): boolean {
  if (order.cancelled_at) return false;
  const day = today.toISOString().slice(0, 10);
  return items.some((item) => {
    if (item.status === "remis" || item.status === "annule") return false;
    const due = item.due_date ?? order.promised_date;
    return Boolean(due) && due! < day;
  });
}

function lineTotals(items: OrderItemRow[], currency: CurrencyCode): Money[] {
  return items
    .filter((item) => item.status !== "annule")
    .map((item) => multiply(money(item.unit_price_amount, currency), item.quantity));
}

export async function getOrderBalance(orderId: string, currency: CurrencyCode): Promise<OrderBalance> {
  const itemsCollection = await collection("order_items");
  const orders = await collection("orders");
  const movements = await collection("financial_movements");
  const [items, order, movementRows] = await Promise.all([
    itemsCollection.find({ order_id: orderId }, { projection: { _id: 0 } })
      .sort({ sort_order: 1, created_at: 1 }).toArray() as unknown as Promise<OrderItemRow[]>,
    orders.findOne({ id: orderId }, { projection: { discount_amount: 1 } }),
    movements.find({ order_id: orderId, status: "confirmed" }, { projection: { kind: 1, amount: 1 } }).toArray(),
  ]);
  return computeOrderBalance({
    currency,
    lineTotals: lineTotals(items, currency),
    discount: money(Number(order?.discount_amount ?? 0), currency),
    confirmedPayments: movementRows.filter((row) => row.kind === "payment").map((row) => money(Number(row.amount), currency)),
    confirmedRefunds: movementRows.filter((row) => row.kind === "refund").map((row) => money(Number(row.amount), currency)),
  });
}

async function attachClientNames(rows: Record<string, unknown>[]): Promise<OrderRow[]> {
  if (rows.length === 0) return [];
  const clients = await collection("clients");
  const ids = [...new Set(rows.map((row) => String(row.client_id)))];
  const names = await clients.find(
    { id: { $in: ids } },
    { projection: { _id: 0, id: 1, display_name: 1 } },
  ).toArray();
  const byId = new Map(names.map((client) => [String(client.id), String(client.display_name)]));
  return rows.map((row) => ({ ...row, client_name: byId.get(String(row.client_id)) ?? "Client supprimé" })) as OrderRow[];
}

export async function listOrders(
  workshopId: string,
  options: { includeMoney: boolean; limit?: number; clientId?: string },
): Promise<OrderSummary[]> {
  const orders = await collection("orders");
  const filter = { workshop_id: workshopId, ...(options.clientId ? { client_id: options.clientId } : {}) };
  const raw = await orders.find(filter, { projection: { _id: 0 } })
    .sort({ created_at: -1 }).limit(options.limit ?? 100).toArray();
  const rows = await attachClientNames(raw);
  return Promise.all(rows.map((order) => buildSummary(order, options.includeMoney)));
}

export async function listOrdersPage(
  workshopId: string,
  options: { includeMoney: boolean; page?: number; pageSize?: number },
): Promise<OrderPage> {
  const orders = await collection("orders");
  const pageSize = Math.min(50, Math.max(1, Math.trunc(options.pageSize ?? 10)));
  const total = await orders.countDocuments({ workshop_id: workshopId });
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(pageCount, Math.max(1, Math.trunc(options.page ?? 1)));
  const raw = await orders.find({ workshop_id: workshopId }, { projection: { _id: 0 } })
    .sort({ created_at: -1, id: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray();
  const rows = await attachClientNames(raw);
  return {
    items: await Promise.all(rows.map((order) => buildSummary(order, options.includeMoney))),
    total, page, pageSize, pageCount,
  };
}

export async function getOrder(
  workshopId: string,
  orderId: string,
  includeMoney: boolean,
): Promise<OrderSummary | null> {
  const orders = await collection("orders");
  const raw = await orders.findOne(
    { workshop_id: workshopId, id: orderId },
    { projection: { _id: 0 } },
  );
  if (!raw) return null;
  const [order] = await attachClientNames([raw]);
  return buildSummary(order, includeMoney);
}

async function buildSummary(order: OrderRow, includeMoney: boolean): Promise<OrderSummary> {
  const itemsCollection = await collection("order_items");
  const items = await itemsCollection.find(
    { order_id: order.id },
    { projection: { _id: 0 } },
  ).sort({ sort_order: 1, created_at: 1 }).toArray() as unknown as OrderItemRow[];
  const currency = order.currency as CurrencyCode;
  return {
    order,
    items: includeMoney ? items : items.map((item) => ({ ...item, unit_price_amount: 0 })),
    state: deriveOrderState(order, items),
    balance: includeMoney ? await getOrderBalance(order.id, currency) : null,
    isLate: isOrderLate(order, items),
  };
}

export async function nextOrderReference(workshopId: string): Promise<string> {
  const orders = await collection("orders");
  const total = await orders.countDocuments({ workshop_id: workshopId });
  return `CMD-${String(total + 1).padStart(4, "0")}`;
}

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  if (input.items.length === 0) {
    throw new OrderWriteError("Ajoutez au moins un article a la commande.");
  }
  if (input.discount.currency !== input.currency) {
    throw new OrderWriteError("La reduction doit utiliser la devise de la commande.");
  }
  if (input.discount.amount < 0) {
    throw new OrderWriteError("La reduction ne peut pas etre negative.");
  }
  if (input.initialPayment) {
    if (input.initialPayment.amount.currency !== input.currency) {
      throw new OrderWriteError("L'acompte doit utiliser la devise de la commande.");
    }
    if (input.initialPayment.amount.amount <= 0) {
      throw new OrderWriteError("L'acompte doit etre strictement positif.");
    }
  }

  return withTransaction(async (session) => {
    const clients = await collection("clients");
    const orders = await collection("orders");
    const orderItems = await collection("order_items");
    const movements = await collection("financial_movements");

    const client = await clients.findOne(
      { id: input.clientId, workshop_id: input.workshopId, deleted_at: null },
      { projection: { id: 1, display_name: 1 }, session },
    );
    if (!client) {
      throw new OrderWriteError("Ce client n'existe plus ou n'est pas accessible.");
    }

    const reference = await nextOrderReferenceInSession(input.workshopId, session);
    const orderId = newId();
    const timestamp = nowIso();

    await orders.insertOne({
      id: orderId,
      workshop_id: input.workshopId,
      client_id: input.clientId,
      reference,
      currency: input.currency,
      discount_amount: input.discount.amount,
      discount_reason: input.discountReason ?? null,
      instructions: input.instructions ?? null,
      promised_date: input.promisedDate ?? null,
      fitting_date: input.fittingDate ?? null,
      cancelled_at: null,
      created_by: input.actorUserId,
      created_at: timestamp,
      updated_at: timestamp,
      row_version: 1,
    }, { session });

    const rows = input.items.map((item, index) => {
      return {
        id: newId(),
        workshop_id: input.workshopId,
        order_id: orderId,
        category: item.category.trim(),
        description: item.description.trim(),
        work_type: item.workType,
        wearer_name: item.wearerName?.trim() || null,
        wearer_relation: item.wearerRelation?.trim() || null,
        quantity: item.quantity,
        unit_price_amount: item.unitPrice.amount,
        currency: input.currency,
        status: "a_realiser",
        due_date: item.dueDate ?? input.promisedDate ?? null,
        delivered_quantity: 0,
        delivered_at: null,
        assignee_user_id: item.assigneeUserId ?? null,
        measurement_snapshot: serialiseItemMeasurements({
          wearerName: item.wearerName,
          wearerRelation: item.wearerRelation,
          values: item.measurementValues,
          notes: item.measurementNotes,
          capturedAt: timestamp.slice(0, 10),
        }),
        cancelled_at: null,
        sort_order: index + 1,
        created_at: timestamp,
        updated_at: timestamp,
        row_version: 1,
      };
    });
    await orderItems.insertMany(rows, { session });

    await recordAudit({
      workshopId: input.workshopId,
      actorUserId: input.actorUserId,
      action: "order.create",
      entityKind: "order",
      entityId: orderId,
      after: {
        reference,
        clientId: input.clientId,
        itemCount: input.items.length,
        discountAmount: input.discount.amount,
      },
    }, session);

    if (input.initialPayment) {
      const existing = await movements.findOne(
        { workshop_id: input.workshopId, idempotency_key: input.initialPayment.idempotencyKey },
        { session },
      );
      if (existing) {
        throw new OrderWriteError("Cette tentative d'encaissement a deja ete utilisee. Rechargez la page.");
      }

      const movementId = newId();
      await movements.insertOne({
        id: movementId,
        workshop_id: input.workshopId,
        order_id: orderId,
        kind: "payment",
        amount: input.initialPayment.amount.amount,
        currency: input.currency,
        method: input.initialPayment.method,
        reference: input.initialPayment.reference ?? null,
        effective_date: input.initialPayment.effectiveDate,
        status: "confirmed",
        reverses_id: null,
        void_reason: null,
        idempotency_key: input.initialPayment.idempotencyKey,
        created_by: input.actorUserId,
        created_at: timestamp,
        row_version: 1,
      }, { session });
      await recordAudit({
        workshopId: input.workshopId,
        actorUserId: input.actorUserId,
        action: "payment.record",
        entityKind: "financial_movement",
        entityId: movementId,
        after: {
          orderId,
          amount: input.initialPayment.amount.amount,
          currency: input.currency,
          method: input.initialPayment.method,
        },
      }, session);
    }

    return { orderId, reference };
  });
}

async function nextOrderReferenceInSession(workshopId: string, session: ClientSession): Promise<string> {
  const orders = await collection("orders");
  const total = await orders.countDocuments({ workshop_id: workshopId }, { session });
  return `CMD-${String(total + 1).padStart(4, "0")}`;
}

function serialiseItemMeasurements(snapshot: {
  wearerName?: string | null;
  wearerRelation?: string | null;
  values?: Record<string, string>;
  notes?: string | null;
  capturedAt: string;
}): string | null {
  const values = Object.fromEntries(
    Object.entries(snapshot.values ?? {}).filter(([key, value]) => key.trim() && value.trim()),
  );
  const wearerName = snapshot.wearerName?.trim() || null;
  const wearerRelation = snapshot.wearerRelation?.trim() || null;
  const notes = snapshot.notes?.trim() || null;
  if (!wearerName && !wearerRelation && Object.keys(values).length === 0 && !notes) return null;

  return JSON.stringify({
    source: "order_item",
    wearer_name: wearerName,
    wearer_relation: wearerRelation,
    values,
    notes,
    captured_at: snapshot.capturedAt,
  });
}
