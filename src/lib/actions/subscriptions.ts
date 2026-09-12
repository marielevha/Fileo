"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireWorkshop } from "@/lib/auth/guards";
import { localePath } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/request";
import { isCurrencyCode, parseAmount } from "@/lib/money";
import {
  declareManualSubscriptionPayment,
  MANUAL_PAYMENT_CHANNELS,
  SubscriptionError,
  type ManualPaymentChannel,
} from "@/lib/repos/subscriptions";

export type SubscriptionPaymentState = { error?: string; ok?: boolean; paymentId?: string };

export async function declareSubscriptionPaymentAction(
  _previous: SubscriptionPaymentState,
  formData: FormData,
): Promise<SubscriptionPaymentState> {
  const session = await requireWorkshop("subscription.manage");
  const locale = await getLocale();
  const planId = String(formData.get("planId") ?? "");
  const amountRaw = String(formData.get("amount") ?? "");
  const currency = String(formData.get("currency") ?? "");
  const channel = String(formData.get("channel") ?? "");
  const externalReference = String(formData.get("externalReference") ?? "").trim();
  const declaredAt = String(formData.get("declaredAt") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "") || randomUUID();

  if (!planId) return { error: "Offre introuvable." };
  if (!isCurrencyCode(currency)) return { error: "Devise invalide." };
  if (!MANUAL_PAYMENT_CHANNELS.includes(channel as ManualPaymentChannel)) {
    return { error: "Moyen de paiement invalide." };
  }
  if (!isDate(declaredAt)) return { error: "Date de paiement invalide." };
  if (declaredAt > new Date().toISOString().slice(0, 10)) {
    return { error: "La date de paiement ne peut pas être dans le futur." };
  }

  let amount;
  try {
    amount = parseAmount(amountRaw, currency);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Montant invalide." };
  }

  try {
    const paymentId = await declareManualSubscriptionPayment({
      workshopId: session.workshop.id,
      actorUserId: session.user.id,
      planId,
      amount,
      channel: channel as ManualPaymentChannel,
      externalReference,
      declaredAt,
      idempotencyKey,
      note,
    });
    revalidatePath(localePath(locale, "/atelier/abonnement"));
    return { ok: true, paymentId };
  } catch (error) {
    return {
      error: error instanceof SubscriptionError ? error.message : "Impossible de déclarer ce paiement.",
    };
  }
}

function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
