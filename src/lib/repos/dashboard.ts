import "server-only";

import { collection } from "@/lib/db";
import { money, type CurrencyCode, type Money } from "@/lib/money";
import { collectedBetween } from "./payments";

export type DashboardCounts = { dueToday: number; dueWithinSevenDays: number; late: number; readyNotDelivered: number };
export type DashboardMoney = { outstanding: Money; collectedThisMonth: Money };
const today = () => new Date().toISOString().slice(0, 10);
const inDays = (days: number) => { const date = new Date(); date.setDate(date.getDate() + days); return date.toISOString().slice(0, 10); };

export async function getDashboardCounts(workshopId: string): Promise<DashboardCounts> {
  const items = await collection("order_items");
  const rows = await items.aggregate<{ status: string; due: string | null }>([
    { $match: { workshop_id: workshopId } },
    { $lookup: { from: "orders", localField: "order_id", foreignField: "id", as: "order" } },
    { $unwind: "$order" }, { $match: { "order.cancelled_at": null } },
    { $project: { _id: 0, status: 1, due: { $ifNull: ["$due_date", "$order.promised_date"] } } },
  ]).toArray();
  const now = today(); const week = inDays(7);
  const live = rows.filter((row) => row.status !== "remis" && row.status !== "annule");
  return {
    dueToday: live.filter((row) => row.due === now).length,
    dueWithinSevenDays: live.filter((row) => row.due && row.due >= now && row.due <= week).length,
    late: live.filter((row) => row.due && row.due < now).length,
    readyNotDelivered: rows.filter((row) => row.status === "pret").length,
  };
}

export async function getDashboardMoney(workshopId: string, currency: CurrencyCode): Promise<DashboardMoney> {
  const orders = await collection("orders");
  const rows = await orders.aggregate<{ order_total: number; net_collected: number }>([
    { $match: { workshop_id: workshopId, cancelled_at: null } },
    { $lookup: { from: "order_items", localField: "id", foreignField: "order_id", as: "items" } },
    { $lookup: { from: "financial_movements", localField: "id", foreignField: "order_id", as: "movements" } },
    { $project: {
      order_total: { $max: [0, { $subtract: [
        { $sum: { $map: { input: { $filter: { input: "$items", as: "item", cond: { $ne: ["$$item.status", "annule"] } } }, as: "item", in: { $multiply: ["$$item.unit_price_amount", "$$item.quantity"] } } } },
        "$discount_amount",
      ] }] },
      net_collected: { $sum: { $map: { input: { $filter: { input: "$movements", as: "movement", cond: { $eq: ["$$movement.status", "confirmed"] } } }, as: "movement", in: { $switch: { branches: [
        { case: { $eq: ["$$movement.kind", "payment"] }, then: "$$movement.amount" },
        { case: { $eq: ["$$movement.kind", "refund"] }, then: { $multiply: ["$$movement.amount", -1] } },
      ], default: 0 } } } } },
    } },
  ]).toArray();
  const outstanding = rows.reduce((sum, row) => sum + Math.max(row.order_total - row.net_collected, 0), 0);
  const monthStart = `${today().slice(0, 7)}-01`;
  return { outstanding: money(outstanding, currency), collectedThisMonth: await collectedBetween(workshopId, monthStart, today(), currency) };
}

export type AgendaItem = { item_id: string; order_id: string; reference: string; client_name: string; description: string; status: string; due_date: string | null };
export async function getAgenda(workshopId: string, limit = 25): Promise<AgendaItem[]> {
  const items = await collection("order_items");
  return items.aggregate<AgendaItem>([
    { $match: { workshop_id: workshopId, status: { $nin: ["remis", "annule"] } } },
    { $lookup: { from: "orders", localField: "order_id", foreignField: "id", as: "order" } },
    { $unwind: "$order" }, { $match: { "order.cancelled_at": null } },
    { $lookup: { from: "clients", localField: "order.client_id", foreignField: "id", as: "client" } },
    { $unwind: "$client" },
    { $set: { item_id: "$id", reference: "$order.reference", client_name: "$client.display_name", due_date: { $ifNull: ["$due_date", "$order.promised_date"] } } },
    { $sort: { due_date: 1 } }, { $limit: limit },
    { $project: { _id: 0, item_id: 1, order_id: 1, reference: 1, client_name: 1, description: 1, status: 1, due_date: 1 } },
  ]).toArray();
}
