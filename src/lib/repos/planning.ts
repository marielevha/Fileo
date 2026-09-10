import "server-only";

import { query, queryOne } from "@/lib/db";
import { ITEM_STATUSES, type ItemStatus } from "@/lib/repos/orders";

export type PlanningStatusFilter = ItemStatus | "active" | "all";
export type PlanningAssigneeFilter = string | "unassigned" | "all";

export type PlanningMember = {
  id: string;
  full_name: string;
  role: string;
};

export type PlanningItem = {
  item_id: string;
  order_id: string;
  workshop_id: string;
  reference: string;
  client_name: string;
  category: string;
  description: string;
  quantity: number;
  status: ItemStatus;
  explicit_due_date: string | null;
  effective_due_date: string | null;
  promised_date: string | null;
  fitting_date: string | null;
  delivered_at: string | null;
  assignee_user_id: string | null;
  assignee_name: string | null;
  row_version: number;
};

export type PlanningItemForUpdate = {
  item_id: string;
  order_id: string;
  workshop_id: string;
  status: ItemStatus;
  due_date: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  assignee_user_id: string | null;
  quantity: number;
  row_version: number;
};

export function listPlanningMembers(workshopId: string): PlanningMember[] {
  return query<PlanningMember>(
    `SELECT u.id, u.full_name, m.role
       FROM memberships m
       JOIN users u ON u.id = m.user_id
      WHERE m.workshop_id = ? AND m.status = 'active' AND u.status = 'active'
      ORDER BY (m.role = 'owner') DESC, u.full_name COLLATE NOCASE`,
    [workshopId],
  );
}

export function listPlanningItems(
  workshopId: string,
  filters: {
    search?: string;
    status?: PlanningStatusFilter;
    assignee?: PlanningAssigneeFilter;
  } = {},
): PlanningItem[] {
  const clauses = ["oi.workshop_id = ?", "o.cancelled_at IS NULL"];
  const params: Array<string | number | null> = [workshopId];
  const search = filters.search?.trim();

  if (search) {
    clauses.push(`(
      oi.description LIKE ? COLLATE NOCASE OR
      oi.category LIKE ? COLLATE NOCASE OR
      o.reference LIKE ? COLLATE NOCASE OR
      c.display_name LIKE ? COLLATE NOCASE
    )`);
    const pattern = `%${search}%`;
    params.push(pattern, pattern, pattern, pattern);
  }

  if (filters.status === "active" || !filters.status) {
    clauses.push("oi.status NOT IN ('remis', 'annule')");
  } else if (filters.status !== "all" && ITEM_STATUSES.includes(filters.status)) {
    clauses.push("oi.status = ?");
    params.push(filters.status);
  }

  if (filters.assignee === "unassigned") {
    clauses.push("oi.assignee_user_id IS NULL");
  } else if (filters.assignee && filters.assignee !== "all") {
    clauses.push("oi.assignee_user_id = ?");
    params.push(filters.assignee);
  }

  return query<PlanningItem>(
    `SELECT oi.id AS item_id, oi.order_id, oi.workshop_id, o.reference,
            c.display_name AS client_name, oi.category, oi.description,
            oi.quantity, oi.status, oi.due_date AS explicit_due_date,
            COALESCE(oi.due_date, o.promised_date) AS effective_due_date,
            o.promised_date, o.fitting_date, oi.delivered_at,
            oi.assignee_user_id, u.full_name AS assignee_name, oi.row_version
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN clients c ON c.id = o.client_id
       LEFT JOIN users u ON u.id = oi.assignee_user_id
      WHERE ${clauses.join(" AND ")}
      ORDER BY
        CASE
          WHEN oi.status NOT IN ('remis', 'annule')
           AND COALESCE(oi.due_date, o.promised_date) < date('now') THEN 0
          WHEN COALESCE(oi.due_date, o.promised_date) = date('now') THEN 1
          WHEN COALESCE(oi.due_date, o.promised_date) IS NULL THEN 3
          ELSE 2
        END,
        COALESCE(oi.due_date, o.promised_date), o.reference, oi.sort_order
      LIMIT 500`,
    params,
  );
}

export function getPlanningItemForUpdate(
  workshopId: string,
  itemId: string,
): PlanningItemForUpdate | null {
  return queryOne<PlanningItemForUpdate>(
    `SELECT oi.id AS item_id, oi.order_id, oi.workshop_id, oi.status,
            oi.due_date, oi.delivered_at, oi.cancelled_at,
            oi.assignee_user_id, oi.quantity, oi.row_version
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
      WHERE oi.workshop_id = ? AND oi.id = ? AND o.cancelled_at IS NULL`,
    [workshopId, itemId],
  );
}

export function isActivePlanningMember(workshopId: string, userId: string): boolean {
  return Boolean(
    queryOne(
      `SELECT 1
         FROM memberships m
         JOIN users u ON u.id = m.user_id
        WHERE m.workshop_id = ? AND m.user_id = ?
          AND m.status = 'active' AND u.status = 'active'`,
      [workshopId, userId],
    ),
  );
}
