import "server-only";

import { collection } from "@/lib/db";
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
