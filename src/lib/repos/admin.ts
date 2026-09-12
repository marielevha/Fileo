import "server-only";

import type { ClientSession } from "mongodb";
import { recordAudit } from "@/lib/audit";
import { collection, newId, nowIso, withTransaction } from "@/lib/db";
import { money, type CurrencyCode, type Money } from "@/lib/money";

export type AdminCounts = { workshops: number; activeWorkshops: number; trials: number; payingWorkshops: number; expiringSoon: number; openTickets: number; pendingPayments: number };
export async function getAdminCounts(): Promise<AdminCounts> {
  const db = {
    workshops: await collection("workshops"), subscriptions: await collection("subscriptions"),
    tickets: await collection("tickets"), payments: await collection("platform_payments"),
  };
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const [workshops, activeWorkshops, trials, payingWorkshops, expiringSoon, openTickets, pendingPayments] = await Promise.all([
    db.workshops.countDocuments(), db.workshops.countDocuments({ status: "active" }),
    db.subscriptions.countDocuments({ status: "trial" }), db.subscriptions.countDocuments({ status: "active" }),
    db.subscriptions.countDocuments({ status: { $in: ["trial", "active", "renewal_due"] }, current_period_end: { $gte: today, $lte: soon } }),
    db.tickets.countDocuments({ status: { $ne: "resolved" } }), db.payments.countDocuments({ status: "declared" }),
  ]);
  return { workshops, activeWorkshops, trials, payingWorkshops, expiringSoon, openTickets, pendingPayments };
}

export async function getRevenueByCurrency(): Promise<Money[]> {
  const payments = await collection("platform_payments");
  const rows = await payments.aggregate<{ currency: string; total: number }>([
    { $match: { status: "validated" } },
    { $group: { _id: "$currency", total: { $sum: "$amount" } } },
    { $project: { _id: 0, currency: "$_id", total: 1 } }, { $sort: { currency: 1 } },
  ]).toArray();
  return rows.map((row) => money(row.total, row.currency as CurrencyCode));
}

export type WorkshopAdminRow = { id: string; name: string; country_code: string; city: string | null; currency: string; status: string; created_at: string; owner_name: string; member_count: number; subscription_status: string | null; current_period_end: string | null };
export async function listWorkshops(search = ""): Promise<WorkshopAdminRow[]> {
  const workshops = await collection("workshops");
  const match = search.trim() ? { name: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } } : {};
  return workshops.aggregate<WorkshopAdminRow>([
    { $match: match }, { $sort: { created_at: -1 } }, { $limit: 200 },
    { $lookup: { from: "users", localField: "owner_user_id", foreignField: "id", as: "owner" } },
    { $lookup: { from: "memberships", let: { wid: "$id" }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$workshop_id", "$$wid"] }, { $eq: ["$status", "active"] }] } } }], as: "members" } },
    { $lookup: { from: "subscriptions", localField: "id", foreignField: "workshop_id", as: "subscription" } },
    { $set: { owner_name: { $ifNull: [{ $first: "$owner.full_name" }, "—"] }, member_count: { $size: "$members" }, subscription_status: { $ifNull: [{ $first: "$subscription.status" }, null] }, current_period_end: { $ifNull: [{ $first: "$subscription.current_period_end" }, null] } } },
    { $project: { _id: 0, owner: 0, members: 0, subscription: 0 } },
  ]).toArray();
}

export type PlatformPaymentRow = {
  id: string;
  workshop_id: string;
  workshop_name: string;
  subscription_id: string;
  plan_id: string | null;
  plan_label: string | null;
  plan_period_months: number | null;
  subscription_current_period_end: string | null;
  projected_period_start: string | null;
  projected_period_end: string | null;
  amount: number;
  currency: string;
  channel: string;
  external_reference: string | null;
  status: string;
  declared_at: string;
  review_note: string | null;
};
export async function listPlatformPayments(status?: string): Promise<PlatformPaymentRow[]> {
  const payments = await collection("platform_payments");
  const rows = await payments.aggregate<PlatformPaymentRow>([
    { $match: status ? { status } : {} }, { $sort: { declared_at: -1 } }, { $limit: 200 },
    { $lookup: { from: "workshops", localField: "workshop_id", foreignField: "id", as: "workshop" } },
    { $lookup: { from: "subscriptions", localField: "subscription_id", foreignField: "id", as: "subscription" } },
    { $set: { subscription_row: { $first: "$subscription" } } },
    { $set: { effective_plan_id: { $ifNull: ["$plan_id", "$subscription_row.plan_id"] } } },
    { $lookup: { from: "plans", localField: "effective_plan_id", foreignField: "id", as: "plan" } },
    { $set: {
      plan_row: { $first: "$plan" },
      workshop_name: { $ifNull: [{ $first: "$workshop.name" }, "Atelier inconnu"] },
      plan_id: "$effective_plan_id",
      subscription_current_period_end: { $ifNull: ["$subscription_row.current_period_end", null] },
    } },
    { $set: {
      plan_label: { $ifNull: ["$plan_row.label", null] },
      plan_period_months: { $ifNull: ["$plan_row.period_months", null] },
    } },
    { $project: { _id: 0, workshop: 0, subscription: 0, subscription_row: 0, plan: 0, plan_row: 0, effective_plan_id: 0 } },
  ]).toArray();
  return Promise.all(rows.map(async (row) => {
    if (!row.plan_period_months) return { ...row, projected_period_start: null, projected_period_end: null };
    const base = await nextPaymentPeriodStart(row.workshop_id, row.subscription_current_period_end);
    return {
      ...row,
      projected_period_start: base,
      projected_period_end: addMonths(base, row.plan_period_months),
    };
  }));
}

export async function validatePlatformPayment(params: { paymentId: string; reviewerUserId: string; note?: string | null }): Promise<{ alreadyValidated: boolean; scheduledForLater?: boolean }> {
  return withTransaction(async (session) => {
    const payments = await collection("platform_payments"); const subscriptions = await collection("subscriptions"); const plans = await collection("plans");
    const payment = await payments.findOne({ id: params.paymentId }, { session });
    if (!payment) throw new Error("Règlement introuvable.");
    if (payment.status === "validated") return { alreadyValidated: true };
    const subscription = await subscriptions.findOne({ id: payment.subscription_id }, { session });
    if (!subscription) throw new Error("Abonnement introuvable.");
    const targetPlanId = payment.plan_id ?? subscription.plan_id;
    const plan = await plans.findOne({ id: targetPlanId }, { projection: { period_months: 1 }, session });
    const today = todayIso();
    const periodStart = await nextPaymentPeriodStart(String(payment.workshop_id), subscription.current_period_end ?? null, session);
    const periodEnd = addMonths(periodStart, Number(plan?.period_months ?? 1));
    const currentStillActive = typeof subscription.current_period_end === "string" && subscription.current_period_end > today;
    const shouldUpdateCurrentSubscription = !currentStillActive || subscription.plan_id === targetPlanId || periodStart <= today;
    const reviewedAt = nowIso();
    const updated = await payments.updateOne(
      { id: params.paymentId, status: { $ne: "validated" } },
      {
        $set: {
          status: "validated",
          reviewed_at: reviewedAt,
          reviewed_by: params.reviewerUserId,
          review_note: params.note ?? null,
          access_period_start: periodStart,
          access_period_end: periodEnd,
        },
      }, { session },
    );
    if (updated.modifiedCount !== 1) return { alreadyValidated: true };
    if (shouldUpdateCurrentSubscription) {
      await subscriptions.updateOne({ id: subscription.id }, { $set: { plan_id: targetPlanId, status: "active", current_period_end: periodEnd, grace_ends_at: null, updated_at: reviewedAt }, $inc: { row_version: 1 } }, { session });
    }
    await recordAudit({ workshopId: String(payment.workshop_id), actorUserId: params.reviewerUserId, action: "platform_payment.validate", entityKind: "platform_payment", entityId: String(payment.id), reason: params.note ?? null, before: { planId: subscription.plan_id, subscriptionEnd: subscription.current_period_end }, after: { planId: shouldUpdateCurrentSubscription ? targetPlanId : subscription.plan_id, subscriptionEnd: shouldUpdateCurrentSubscription ? periodEnd : subscription.current_period_end, scheduledPlanId: targetPlanId, accessPeriodStart: periodStart, accessPeriodEnd: periodEnd } }, session);
    return { alreadyValidated: false, scheduledForLater: !shouldUpdateCurrentSubscription };
  });
}

export async function rejectPlatformPayment(params: { paymentId: string; reviewerUserId: string; note: string }): Promise<void> {
  const payments = await collection("platform_payments");
  await payments.updateOne({ id: params.paymentId, status: "declared" }, { $set: { status: "rejected", reviewed_at: nowIso(), reviewed_by: params.reviewerUserId, review_note: params.note } });
  await recordAudit({ actorUserId: params.reviewerUserId, action: "platform_payment.reject", entityKind: "platform_payment", entityId: params.paymentId, reason: params.note });
}

export type AuditRow = { id: string; workshop_id: string | null; actor_name: string | null; action: string; entity_kind: string; entity_id: string | null; reason: string | null; created_at: string };
export async function listAudit(limit = 100): Promise<AuditRow[]> {
  const audit = await collection("audit_log");
  return audit.aggregate<AuditRow>([
    { $sort: { created_at: -1 } }, { $limit: limit },
    { $lookup: { from: "users", localField: "actor_user_id", foreignField: "id", as: "actor" } },
    { $set: { actor_name: { $ifNull: [{ $first: "$actor.full_name" }, null] } } },
    { $project: { _id: 0, actor: 0 } },
  ]).toArray();
}

export type TicketRow = { id: string; workshop_id: string | null; workshop_name: string | null; requester_name: string | null; category: string; subject: string; status: string; created_at: string };
export async function listTickets(status?: string): Promise<TicketRow[]> {
  const tickets = await collection("tickets");
  return tickets.aggregate<TicketRow>([
    { $match: status ? { status } : {} }, { $sort: { created_at: -1 } }, { $limit: 200 },
    { $lookup: { from: "workshops", localField: "workshop_id", foreignField: "id", as: "workshop" } },
    { $set: { workshop_name: { $ifNull: [{ $first: "$workshop.name" }, null] } } },
    { $project: { _id: 0, workshop: 0 } },
  ]).toArray();
}

export async function createTicket(params: { workshopId?: string | null; requesterUserId?: string | null; requesterName: string; requesterContact: string; category: string; subject: string; body: string }): Promise<string> {
  const id = newId(); const timestamp = nowIso(); const tickets = await collection("tickets");
  await tickets.insertOne({ id, workshop_id: params.workshopId ?? null, requester_user_id: params.requesterUserId ?? null, requester_name: params.requesterName, requester_contact: params.requesterContact, category: params.category, subject: params.subject, body: params.body, status: "open", assignee_user_id: null, created_at: timestamp, updated_at: timestamp });
  return id;
}

async function nextPaymentPeriodStart(
  workshopId: string,
  currentPeriodEnd: string | null,
  session?: ClientSession,
): Promise<string> {
  const payments = await collection("platform_payments");
  const latest = await payments.findOne(
    {
      workshop_id: workshopId,
      status: "validated",
      access_period_end: { $type: "string" },
    },
    {
      projection: { access_period_end: 1 },
      sort: { access_period_end: -1 },
      session,
    },
  );
  return maxIsoDate(todayIso(), currentPeriodEnd, latest?.access_period_end ? String(latest.access_period_end) : null);
}

function addMonths(startIso: string, months: number): string {
  const date = new Date(`${startIso}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 10);
}

function maxIsoDate(...values: Array<string | null | undefined>): string {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? todayIso();
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
