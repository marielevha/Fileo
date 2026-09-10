import "server-only";

import { query, queryOne } from "@/lib/db";
import { money, type CurrencyCode, type Money } from "@/lib/money";
import { collectedBetween } from "./payments";

/**
 * Workshop dashboard — cahier des charges §8.1.
 *
 * Every indicator opens a list, so each figure is paired with the filter that
 * reproduces it. Totals exclude cancelled items and always carry a currency.
 */

export type DashboardCounts = {
  dueToday: number;
  dueWithinSevenDays: number;
  late: number;
  readyNotDelivered: number;
};

export type DashboardMoney = {
  outstanding: Money;
  collectedThisMonth: Money;
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function inDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Items still to hand over, i.e. neither delivered nor cancelled, on an order
 * that is itself not cancelled. Shared by every count below.
 */
const LIVE_ITEM = `
  oi.status NOT IN ('remis', 'annule')
  AND o.cancelled_at IS NULL
`;

export function getDashboardCounts(workshopId: string): DashboardCounts {
  const row = queryOne<{
    due_today: number;
    due_week: number;
    late: number;
    ready: number;
  }>(
    `SELECT
       SUM(CASE WHEN ${LIVE_ITEM} AND COALESCE(oi.due_date, o.promised_date) = ?
                THEN 1 ELSE 0 END) AS due_today,
       SUM(CASE WHEN ${LIVE_ITEM} AND COALESCE(oi.due_date, o.promised_date) BETWEEN ? AND ?
                THEN 1 ELSE 0 END) AS due_week,
       SUM(CASE WHEN ${LIVE_ITEM} AND COALESCE(oi.due_date, o.promised_date) < ?
                THEN 1 ELSE 0 END) AS late,
       SUM(CASE WHEN oi.status = 'pret' AND o.cancelled_at IS NULL
                THEN 1 ELSE 0 END) AS ready
     FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
    WHERE oi.workshop_id = ?`,
    [today(), today(), inDays(7), today(), workshopId],
  );

  return {
    dueToday: row?.due_today ?? 0,
    dueWithinSevenDays: row?.due_week ?? 0,
    late: row?.late ?? 0,
    readyNotDelivered: row?.ready ?? 0,
  };
}

/**
 * Outstanding receivables across the workshop.
 *
 * Computed per order rather than in one aggregate: the discount cap and the
 * overpayment floor of §8.7 do not survive a naive SUM, and an overpaid order
 * must not offset another order's debt.
 */
export function getDashboardMoney(workshopId: string, currency: CurrencyCode): DashboardMoney {
  const rows = query<{ order_total: number; net_collected: number }>(
    `SELECT
       o.id,
       MAX(0,
         COALESCE((SELECT SUM(oi.unit_price_amount * oi.quantity)
                     FROM order_items oi
                    WHERE oi.order_id = o.id AND oi.status <> 'annule'), 0)
         - o.discount_amount
       ) AS order_total,
       COALESCE((SELECT SUM(CASE WHEN m.kind = 'payment' THEN m.amount
                                 WHEN m.kind = 'refund'  THEN -m.amount
                                 ELSE 0 END)
                   FROM financial_movements m
                  WHERE m.order_id = o.id AND m.status = 'confirmed'), 0) AS net_collected
     FROM orders o
    WHERE o.workshop_id = ? AND o.cancelled_at IS NULL
    GROUP BY o.id`,
    [workshopId],
  );

  const outstanding = rows.reduce((total, row) => {
    const due = row.order_total - row.net_collected;
    return total + Math.max(due, 0);
  }, 0);

  const monthStart = `${today().slice(0, 7)}-01`;

  return {
    outstanding: money(outstanding, currency),
    collectedThisMonth: collectedBetween(workshopId, monthStart, today(), currency),
  };
}

export type AgendaItem = {
  item_id: string;
  order_id: string;
  reference: string;
  client_name: string;
  description: string;
  status: string;
  due_date: string | null;
};

/** Upcoming and overdue work, ordered by urgency then deadline (§8.6). */
export function getAgenda(workshopId: string, limit = 25): AgendaItem[] {
  return query<AgendaItem>(
    `SELECT oi.id AS item_id, o.id AS order_id, o.reference,
            c.display_name AS client_name, oi.description, oi.status,
            COALESCE(oi.due_date, o.promised_date) AS due_date
       FROM order_items oi
       JOIN orders o  ON o.id = oi.order_id
       JOIN clients c ON c.id = o.client_id
      WHERE oi.workshop_id = ? AND ${LIVE_ITEM}
      ORDER BY (due_date IS NULL), due_date ASC
      LIMIT ?`,
    [workshopId, limit],
  );
}
