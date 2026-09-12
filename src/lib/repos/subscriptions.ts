import "server-only";

import type { ClientSession } from "mongodb";
import { recordAudit } from "@/lib/audit";
import { collection, newId, nowIso, withTransaction } from "@/lib/db";
import { parseLimits, type PlanLimits, type PlanRow } from "@/lib/repos/contents";
import { money, type CurrencyCode, type Money } from "@/lib/money";

export type SubscriptionStatus = "trial" | "active" | "renewal_due" | "suspended" | "cancelled";
export type ManualPaymentChannel = "mobile_money" | "airtel_money" | "transfer" | "cash";

export const MANUAL_PAYMENT_CHANNELS: ManualPaymentChannel[] = [
  "mobile_money",
  "airtel_money",
  "transfer",
  "cash",
];

export const PAYMENT_CHANNEL_LABELS: Record<ManualPaymentChannel, string> = {
  mobile_money: "MTN MoMo",
  airtel_money: "Airtel Money",
  transfer: "Virement",
  cash: "Espèces",
};

export type SubscriptionRow = {
  id: string;
  workshop_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
  grace_ends_at: string | null;
  cancel_at_period_end: number;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PlatformPaymentStatus = "declared" | "provider_pending" | "validated" | "rejected";
export type SubscriptionPaymentProvider = "manual" | "mtn_momo";

export type WorkshopPaymentRow = {
  id: string;
  plan_id: string | null;
  plan_label: string | null;
  amount: number;
  currency: string;
  channel: string;
  provider: SubscriptionPaymentProvider;
  provider_status: string | null;
  provider_reference_id: string | null;
  external_reference: string | null;
  status: PlatformPaymentStatus;
  declared_at: string;
  reviewed_at: string | null;
  review_note: string | null;
};

export type PlanWithLimits = PlanRow & { limits: PlanLimits; price: Money };

export type SubscriptionUsage = {
  activeMembers: number;
  memberLimit: number | null;
  remainingMembers: number | null;
  memberLimitReached: boolean;
  memberLimitExceeded: boolean;
};

export type SubscriptionOverview = {
  subscription: SubscriptionRow | null;
  currentPlan: PlanWithLimits | null;
  availablePlans: PlanWithLimits[];
  usage: SubscriptionUsage;
  payments: WorkshopPaymentRow[];
};

export async function getSubscriptionOverview(input: {
  workshopId: string;
  countryCode: string;
  currency: CurrencyCode;
}): Promise<SubscriptionOverview> {
  const [subscription, availablePlans, payments] = await Promise.all([
    getCurrentSubscription(input.workshopId),
    listAvailablePlans(input.countryCode, input.currency),
    listWorkshopSubscriptionPayments(input.workshopId),
  ]);
  const currentPlan = subscription
    ? availablePlans.find((plan) => plan.id === subscription.plan_id) ?? await getPlanWithLimits(subscription.plan_id, input.currency)
    : null;
  const usage = await getSubscriptionUsage(input.workshopId, currentPlan?.limits ?? null);

  return { subscription, currentPlan, availablePlans, usage, payments };
}

export async function declareManualSubscriptionPayment(input: {
  workshopId: string;
  actorUserId: string;
  planId: string;
  amount: Money;
  channel: ManualPaymentChannel;
  externalReference: string;
  declaredAt: string;
  idempotencyKey: string;
  note?: string | null;
}): Promise<string> {
  if (input.amount.amount <= 0) throw new SubscriptionError("Le montant payé doit être positif.");
  if (!input.externalReference.trim()) throw new SubscriptionError("La référence de paiement est obligatoire.");

  return withTransaction(async (session) => {
    const subscriptions = await collection("subscriptions");
    const payments = await collection("platform_payments");
    const plans = await collection("plans");
    const subscription = await subscriptions.findOne(
      { workshop_id: input.workshopId, status: { $in: ["trial", "active", "renewal_due"] } },
      { sort: { current_period_end: -1, created_at: -1 }, session },
    );
    if (!subscription) throw new SubscriptionError("Aucun abonnement actif ou en essai n'est associé à cet atelier.");
    const plan = await plans.findOne(
      { id: input.planId, archived_at: null },
      { projection: { id: 1, currency: 1, price_amount: 1, label: 1 }, session },
    );
    if (!plan) throw new SubscriptionError("Offre introuvable.");
    if (plan.currency !== input.amount.currency) {
      throw new SubscriptionError(`Devise incompatible : l'offre est en ${plan.currency}.`);
    }

    const duplicateReference = await payments.findOne(
      {
        workshop_id: input.workshopId,
        external_reference: input.externalReference.trim(),
        status: { $ne: "rejected" },
      },
      { projection: { id: 1 }, session },
    );
    if (duplicateReference) {
      throw new SubscriptionError("Cette référence de transaction a déjà été déclarée.");
    }
    const pendingForPlan = await payments.findOne(
      {
        workshop_id: input.workshopId,
        plan_id: plan.id,
        status: { $in: ["declared", "provider_pending"] },
      },
      { projection: { id: 1 }, session },
    );
    if (pendingForPlan) {
      throw new SubscriptionError("Un paiement est déjà en attente de validation pour cette offre.");
    }

    const existing = await payments.findOne({ idempotency_key: input.idempotencyKey }, { session });
    if (existing) return String(existing.id);

    const id = newId();
    await payments.insertOne({
      id,
      workshop_id: input.workshopId,
      subscription_id: subscription.id,
      plan_id: plan.id,
      amount: input.amount.amount,
      currency: input.amount.currency,
      channel: input.channel,
      provider: "manual",
      provider_status: null,
      provider_reference_id: null,
      external_reference: input.externalReference.trim(),
      status: "declared",
      idempotency_key: input.idempotencyKey,
      declared_at: input.declaredAt,
      reviewed_at: null,
      reviewed_by: null,
      review_note: input.note?.trim() || null,
    }, { session });
    await recordAudit({
      workshopId: input.workshopId,
      actorUserId: input.actorUserId,
      action: "platform_payment.declare",
      entityKind: "platform_payment",
      entityId: id,
      after: {
        planId: plan.id,
        amount: input.amount.amount,
        currency: input.amount.currency,
        channel: input.channel,
      },
    }, session);

    return id;
  });
}

export async function createProviderSubscriptionPayment(input: {
  workshopId: string;
  actorUserId: string;
  planId: string;
  amount: Money;
  provider: Exclude<SubscriptionPaymentProvider, "manual">;
  providerReferenceId: string;
  providerAmount: string;
  providerCurrency: string;
  externalId: string;
  payerPhoneE164: string;
  payerMsisdn: string;
  idempotencyKey: string;
}): Promise<{ paymentId: string; providerReferenceId: string; externalId: string }> {
  return withTransaction(async (session) => {
    const subscriptions = await collection("subscriptions");
    const payments = await collection("platform_payments");
    const plans = await collection("plans");
    const subscription = await subscriptions.findOne(
      { workshop_id: input.workshopId, status: { $in: ["trial", "active", "renewal_due"] } },
      { sort: { current_period_end: -1, created_at: -1 }, session },
    );
    if (!subscription) throw new SubscriptionError("Aucun abonnement actif ou en essai n'est associé à cet atelier.");
    const plan = await plans.findOne(
      { id: input.planId, archived_at: null },
      { projection: { id: 1, currency: 1, price_amount: 1, label: 1 }, session },
    );
    if (!plan) throw new SubscriptionError("Offre introuvable.");
    if (plan.currency !== input.amount.currency) {
      throw new SubscriptionError(`Devise incompatible : l'offre est en ${plan.currency}.`);
    }

    const pendingForPlan = await payments.findOne(
      {
        workshop_id: input.workshopId,
        plan_id: plan.id,
        status: { $in: ["declared", "provider_pending"] },
      },
      { projection: { id: 1 }, session },
    );
    if (pendingForPlan) {
      throw new SubscriptionError("Un paiement est déjà en attente de validation pour cette offre.");
    }

    const existing = await payments.findOne({ idempotency_key: input.idempotencyKey }, { session });
    if (existing) {
      return {
        paymentId: String(existing.id),
        providerReferenceId: String(existing.provider_reference_id ?? input.providerReferenceId),
        externalId: String(existing.external_id ?? input.externalId),
      };
    }

    const id = newId();
    await payments.insertOne({
      id,
      workshop_id: input.workshopId,
      subscription_id: subscription.id,
      plan_id: plan.id,
      amount: input.amount.amount,
      currency: input.amount.currency,
      channel: input.provider,
      provider: input.provider,
      provider_status: "INITIATED",
      provider_reference_id: input.providerReferenceId,
      provider_amount: input.providerAmount,
      provider_currency: input.providerCurrency,
      provider_checked_at: null,
      provider_payload: null,
      external_id: input.externalId,
      external_reference: input.providerReferenceId,
      payer_phone: input.payerPhoneE164,
      payer_msisdn: input.payerMsisdn,
      status: "provider_pending",
      idempotency_key: input.idempotencyKey,
      declared_at: new Date().toISOString().slice(0, 10),
      reviewed_at: null,
      reviewed_by: null,
      review_note: null,
    }, { session });
    await recordAudit({
      workshopId: input.workshopId,
      actorUserId: input.actorUserId,
      action: "platform_payment.declare",
      entityKind: "platform_payment",
      entityId: id,
      after: {
        planId: plan.id,
        amount: input.amount.amount,
        currency: input.amount.currency,
        provider: input.provider,
      },
    }, session);

    return { paymentId: id, providerReferenceId: input.providerReferenceId, externalId: input.externalId };
  });
}

export async function markProviderPaymentRequested(input: {
  paymentId: string;
  workshopId: string;
  providerStatus: string;
}): Promise<void> {
  const payments = await collection("platform_payments");
  await payments.updateOne(
    { id: input.paymentId, workshop_id: input.workshopId, status: "provider_pending" },
    {
      $set: {
        provider_status: input.providerStatus,
        provider_checked_at: nowIso(),
      },
    },
  );
}

export async function markProviderPaymentFailed(input: {
  paymentId: string;
  workshopId: string;
  reason: string;
  providerStatus?: string;
  payload?: unknown;
}): Promise<void> {
  const payments = await collection("platform_payments");
  await payments.updateOne(
    { id: input.paymentId, workshop_id: input.workshopId, status: "provider_pending" },
    {
      $set: {
        status: "rejected",
        provider_status: input.providerStatus ?? "FAILED",
        provider_checked_at: nowIso(),
        provider_payload: input.payload ?? null,
        reviewed_at: nowIso(),
        review_note: input.reason,
      },
    },
  );
}

export async function getProviderPaymentForCheck(input: {
  paymentId: string;
  workshopId: string;
  provider: Exclude<SubscriptionPaymentProvider, "manual">;
}): Promise<{
  id: string;
  provider_reference_id: string;
  status: PlatformPaymentStatus;
} | null> {
  const payments = await collection("platform_payments");
  const payment = await payments.findOne(
    {
      id: input.paymentId,
      workshop_id: input.workshopId,
      provider: input.provider,
    },
    { projection: { _id: 0, id: 1, provider_reference_id: 1, status: 1 } },
  );
  if (!payment?.provider_reference_id) return null;
  return {
    id: String(payment.id),
    provider_reference_id: String(payment.provider_reference_id),
    status: payment.status as PlatformPaymentStatus,
  };
}

export async function recordProviderPaymentStatus(input: {
  paymentId: string;
  workshopId: string;
  providerStatus: string;
  payload: unknown;
}): Promise<void> {
  const payments = await collection("platform_payments");
  await payments.updateOne(
    { id: input.paymentId, workshop_id: input.workshopId },
    {
      $set: {
        provider_status: input.providerStatus,
        provider_checked_at: nowIso(),
        provider_payload: input.payload,
      },
    },
  );
}

export class SubscriptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubscriptionError";
  }
}

export async function getCurrentSubscription(
  workshopId: string,
  session?: ClientSession,
): Promise<SubscriptionRow | null> {
  const subscriptions = await collection("subscriptions");
  const subscription = await subscriptions.findOne(
    { workshop_id: workshopId },
    { projection: { _id: 0 }, sort: { current_period_end: -1, created_at: -1 }, session },
  ) as SubscriptionRow | null;
  if (!subscription) return null;

  const today = new Date().toISOString().slice(0, 10);
  const payments = await collection("platform_payments");
  const activePayment = await payments.findOne(
    {
      workshop_id: workshopId,
      status: "validated",
      plan_id: { $type: "string" },
      access_period_start: { $lte: today },
      access_period_end: { $gt: today },
    },
    {
      projection: { plan_id: 1, access_period_start: 1, access_period_end: 1 },
      sort: { access_period_start: -1, reviewed_at: -1 },
      session,
    },
  );

  if (!activePayment?.plan_id || !activePayment.access_period_end) return subscription;
  let effectiveEnd = String(activePayment.access_period_end);
  const contiguousPayments = await payments.find(
    {
      workshop_id: workshopId,
      status: "validated",
      plan_id: activePayment.plan_id,
      access_period_start: { $gte: String(activePayment.access_period_start ?? today) },
      access_period_end: { $type: "string" },
    },
    {
      projection: { access_period_start: 1, access_period_end: 1 },
      sort: { access_period_start: 1, reviewed_at: 1 },
      session,
    },
  ).toArray();
  for (const period of contiguousPayments) {
    const start = String(period.access_period_start ?? "");
    const end = String(period.access_period_end ?? "");
    if (!start || !end || start > effectiveEnd) break;
    if (end > effectiveEnd) effectiveEnd = end;
  }

  return {
    ...subscription,
    plan_id: String(activePayment.plan_id),
    status: "active",
    current_period_end: effectiveEnd,
  };
}

async function listAvailablePlans(countryCode: string, currency: CurrencyCode): Promise<PlanWithLimits[]> {
  const plans = await collection("plans");
  const rows = await plans.aggregate<PlanRow>([
    { $match: { country_code: countryCode, currency, archived_at: null } },
    { $sort: { code: 1, version: -1 } },
    { $group: { _id: "$code", plan: { $first: "$$ROOT" } } },
    { $replaceWith: "$plan" },
    { $project: { _id: 0 } },
    { $sort: { price_amount: 1 } },
  ]).toArray();
  return rows.map((plan) => withLimits(plan, currency));
}

async function getPlanWithLimits(planId: string, currency: CurrencyCode): Promise<PlanWithLimits | null> {
  const plans = await collection("plans");
  const plan = await plans.findOne({ id: planId }, { projection: { _id: 0 } }) as PlanRow | null;
  return plan ? withLimits(plan, currency) : null;
}

async function getSubscriptionUsage(workshopId: string, limits: PlanLimits | null): Promise<SubscriptionUsage> {
  const memberships = await collection("memberships");
  const activeMembers = await memberships.countDocuments({ workshop_id: workshopId, status: "active" });
  const memberLimit = limits?.members ?? null;
  const remainingMembers = memberLimit === null ? null : Math.max(memberLimit - activeMembers, 0);
  return {
    activeMembers,
    memberLimit,
    remainingMembers,
    memberLimitReached: memberLimit !== null && activeMembers >= memberLimit,
    memberLimitExceeded: memberLimit !== null && activeMembers > memberLimit,
  };
}

async function listWorkshopSubscriptionPayments(workshopId: string): Promise<WorkshopPaymentRow[]> {
  const payments = await collection("platform_payments");
  return payments.aggregate<WorkshopPaymentRow>([
    { $match: { workshop_id: workshopId } },
    { $sort: { declared_at: -1 } },
    { $limit: 25 },
    { $lookup: { from: "plans", localField: "plan_id", foreignField: "id", as: "plan" } },
    { $set: { plan_label: { $ifNull: [{ $first: "$plan.label" }, null] } } },
    { $project: { _id: 0, plan: 0 } },
  ]).toArray();
}

function withLimits(plan: PlanRow, currency: CurrencyCode): PlanWithLimits {
  return {
    ...plan,
    limits: parseLimits(plan.limits_json),
    price: money(Number(plan.price_amount), currency),
  };
}
