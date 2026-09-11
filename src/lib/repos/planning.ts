import "server-only";

import { collection } from "@/lib/db";
import { ITEM_STATUSES, type ItemStatus } from "@/lib/repos/orders";

export type PlanningStatusFilter = ItemStatus | "active" | "all";
export type PlanningAssigneeFilter = string | "unassigned" | "all";
export type PlanningMember = { id: string; full_name: string; role: string };
export type PlanningItem = {
  item_id: string; order_id: string; workshop_id: string; reference: string;
  client_name: string; category: string; description: string; quantity: number;
  status: ItemStatus; explicit_due_date: string | null; effective_due_date: string | null;
  promised_date: string | null; fitting_date: string | null; delivered_at: string | null;
  assignee_user_id: string | null; assignee_name: string | null; row_version: number;
};
export type PlanningItemForUpdate = {
  item_id: string; order_id: string; workshop_id: string; status: ItemStatus;
  due_date: string | null; delivered_at: string | null; cancelled_at: string | null;
  assignee_user_id: string | null; quantity: number; row_version: number;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function listPlanningMembers(workshopId: string): Promise<PlanningMember[]> {
  const memberships = await collection("memberships");
  return memberships.aggregate<PlanningMember>([
    { $match: { workshop_id: workshopId, status: "active" } },
    { $lookup: { from: "users", localField: "user_id", foreignField: "id", as: "user" } },
    { $unwind: "$user" },
    { $match: { "user.status": "active" } },
    { $set: { id: "$user.id", full_name: "$user.full_name", role_rank: { $cond: [{ $eq: ["$role", "owner"] }, 0, 1] } } },
    { $sort: { role_rank: 1, full_name: 1 } },
    { $project: { _id: 0, id: 1, full_name: 1, role: 1 } },
  ], { collation: { locale: "fr", strength: 1 } }).toArray();
}

export async function listPlanningItems(
  workshopId: string,
  filters: { search?: string; status?: PlanningStatusFilter; assignee?: PlanningAssigneeFilter } = {},
): Promise<PlanningItem[]> {
  const items = await collection("order_items");
  const match: Record<string, unknown> = { workshop_id: workshopId };
  if (filters.status === "active" || !filters.status) match.status = { $nin: ["remis", "annule"] };
  else if (filters.status !== "all" && ITEM_STATUSES.includes(filters.status)) match.status = filters.status;
  if (filters.assignee === "unassigned") match.assignee_user_id = null;
  else if (filters.assignee && filters.assignee !== "all") match.assignee_user_id = filters.assignee;

  const search = filters.search?.trim();
  const today = new Date().toISOString().slice(0, 10);
  const pipeline: Record<string, unknown>[] = [
    { $match: match },
    { $lookup: { from: "orders", localField: "order_id", foreignField: "id", as: "order" } },
    { $unwind: "$order" },
    { $match: { "order.cancelled_at": null, "order.workshop_id": workshopId } },
    { $lookup: { from: "clients", localField: "order.client_id", foreignField: "id", as: "client" } },
    { $unwind: "$client" },
    { $lookup: { from: "users", localField: "assignee_user_id", foreignField: "id", as: "assignee" } },
    {
      $set: {
        item_id: "$id", reference: "$order.reference", client_name: "$client.display_name",
        explicit_due_date: "$due_date", effective_due_date: { $ifNull: ["$due_date", "$order.promised_date"] },
        promised_date: "$order.promised_date", fitting_date: "$order.fitting_date",
        assignee_name: { $ifNull: [{ $first: "$assignee.full_name" }, null] },
      },
    },
  ];
  if (search) {
    const regex = escapeRegex(search);
    pipeline.push({ $match: { $or: [
      { description: { $regex: regex, $options: "i" } },
      { category: { $regex: regex, $options: "i" } },
      { reference: { $regex: regex, $options: "i" } },
      { client_name: { $regex: regex, $options: "i" } },
    ] } });
  }
  pipeline.push(
    { $set: { urgency: { $switch: { branches: [
      { case: { $and: [{ $not: [{ $in: ["$status", ["remis", "annule"]] }] }, { $lt: ["$effective_due_date", today] }] }, then: 0 },
      { case: { $eq: ["$effective_due_date", today] }, then: 1 },
      { case: { $eq: ["$effective_due_date", null] }, then: 3 },
    ], default: 2 } } } },
    { $sort: { urgency: 1, effective_due_date: 1, reference: 1, sort_order: 1 } },
    { $limit: 500 },
    { $project: {
      _id: 0, item_id: 1, order_id: 1, workshop_id: 1, reference: 1, client_name: 1,
      category: 1, description: 1, quantity: 1, status: 1, explicit_due_date: 1,
      effective_due_date: 1, promised_date: 1, fitting_date: 1, delivered_at: 1,
      assignee_user_id: 1, assignee_name: 1, row_version: 1,
    } },
  );
  return items.aggregate<PlanningItem>(pipeline).toArray();
}

export async function getPlanningItemForUpdate(
  workshopId: string,
  itemId: string,
): Promise<PlanningItemForUpdate | null> {
  const items = await collection("order_items");
  const item = await items.findOne(
    { workshop_id: workshopId, id: itemId },
    { projection: { _id: 0 } },
  );
  if (!item) return null;
  const orders = await collection("orders");
  const order = await orders.findOne({ id: item.order_id, workshop_id: workshopId, cancelled_at: null }, { projection: { id: 1 } });
  if (!order) return null;
  return {
    item_id: String(item.id), order_id: String(item.order_id), workshop_id: String(item.workshop_id),
    status: item.status as ItemStatus, due_date: item.due_date as string | null,
    delivered_at: item.delivered_at as string | null, cancelled_at: item.cancelled_at as string | null,
    assignee_user_id: item.assignee_user_id as string | null, quantity: Number(item.quantity),
    row_version: Number(item.row_version),
  };
}

export async function isActivePlanningMember(workshopId: string, userId: string): Promise<boolean> {
  const memberships = await collection("memberships");
  const member = await memberships.findOne({ workshop_id: workshopId, user_id: userId, status: "active" });
  if (!member) return false;
  const users = await collection("users");
  return Boolean(await users.findOne({ id: userId, status: "active" }, { projection: { id: 1 } }));
}
