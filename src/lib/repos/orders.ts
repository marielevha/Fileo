import "server-only";

import { query, queryOne } from "@/lib/db";
import {
  computeOrderBalance,
  money,
  multiply,
  type CurrencyCode,
  type Money,
  type OrderBalance,
} from "@/lib/money";

/**
 * Order reads, including the derived state the spec defines in §8.4 and the
 * balance rules in §8.7. All queries are scoped by workshop_id — never trust a
 * caller-supplied id alone (§16, REC-11).
 */

export const ITEM_STATUSES = [
  "a_realiser",
  "en_cours",
  "a_essayer",
  "pret",
  "remis",
  "annule",
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

/** Derived order state (§8.4) — never stored, always computed. */
export type OrderState =
  | "nouvelle"
  | "en_cours"
  | "prete"
  | "partiellement_remise"
  | "remise"
  | "annulee";

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
  /** Present only when the caller may see money (§4.2). */
  balance: OrderBalance | null;
  isLate: boolean;
};

/**
 * Derives the order state from its items.
 *
 * §8.4: an order whose non-cancelled items are all delivered is "remise" —
 * it may still be financially unpaid, which is a separate axis entirely.
 */
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

/**
 * §8.1: late means a promised date has passed while the item is neither
 * delivered nor cancelled. It is a computed indicator, not a status that
 * overwrites progress.
 */
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

/** Confirmed movements only — pending offline entries never count (§8.7). */
function movementTotals(orderId: string, currency: CurrencyCode) {
  const rows = query<{ kind: string; amount: number }>(
    `SELECT kind, amount FROM financial_movements
      WHERE order_id = ? AND status = 'confirmed'`,
    [orderId],
  );

  return {
    payments: rows.filter((r) => r.kind === "payment").map((r) => money(r.amount, currency)),
    refunds: rows.filter((r) => r.kind === "refund").map((r) => money(r.amount, currency)),
  };
}

export function getOrderBalance(orderId: string, currency: CurrencyCode): OrderBalance {
  const items = query<OrderItemRow>(
    `SELECT * FROM order_items WHERE order_id = ? ORDER BY sort_order, created_at`,
    [orderId],
  );

  const order = queryOne<{ discount_amount: number }>(
    `SELECT discount_amount FROM orders WHERE id = ?`,
    [orderId],
  );

  const { payments, refunds } = movementTotals(orderId, currency);

  return computeOrderBalance({
    currency,
    lineTotals: lineTotals(items, currency),
    discount: money(order?.discount_amount ?? 0, currency),
    confirmedPayments: payments,
    confirmedRefunds: refunds,
  });
}

export function listOrders(
  workshopId: string,
  options: { includeMoney: boolean; limit?: number; clientId?: string },
): OrderSummary[] {
  const rows = query<OrderRow>(
    `SELECT o.*, c.display_name AS client_name
       FROM orders o
       JOIN clients c ON c.id = o.client_id
      WHERE o.workshop_id = ?
        AND (? IS NULL OR o.client_id = ?)
      ORDER BY o.created_at DESC
      LIMIT ?`,
    [workshopId, options.clientId ?? null, options.clientId ?? null, options.limit ?? 100],
  );

  return rows.map((order) => buildSummary(order, options.includeMoney));
}

export function getOrder(
  workshopId: string,
  orderId: string,
  includeMoney: boolean,
): OrderSummary | null {
  const order = queryOne<OrderRow>(
    `SELECT o.*, c.display_name AS client_name
       FROM orders o
       JOIN clients c ON c.id = o.client_id
      WHERE o.workshop_id = ? AND o.id = ?`,
    [workshopId, orderId],
  );

  return order ? buildSummary(order, includeMoney) : null;
}

function buildSummary(order: OrderRow, includeMoney: boolean): OrderSummary {
  const items = query<OrderItemRow>(
    `SELECT * FROM order_items WHERE order_id = ? ORDER BY sort_order, created_at`,
    [order.id],
  );

  const currency = order.currency as CurrencyCode;

  return {
    order,
    // Prices are stripped for actors without money.read (REC-12).
    items: includeMoney
      ? items
      : items.map((item) => ({ ...item, unit_price_amount: 0 })),
    state: deriveOrderState(order, items),
    balance: includeMoney ? getOrderBalance(order.id, currency) : null,
    isLate: isOrderLate(order, items),
  };
}

/** Next human-readable reference for the workshop, e.g. CMD-0042 (§8.4). */
export function nextOrderReference(workshopId: string): string {
  const row = queryOne<{ total: number }>(
    `SELECT COUNT(*) AS total FROM orders WHERE workshop_id = ?`,
    [workshopId],
  );

  return `CMD-${String((row?.total ?? 0) + 1).padStart(4, "0")}`;
}
