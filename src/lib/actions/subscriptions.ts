"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireWorkshop } from "@/lib/auth/guards";
import { localePath } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/request";
import { isCurrencyCode, parseAmount } from "@/lib/money";
import {
  getRequestToPayStatus,
  providerMoneyFor,
  requestToPay,
} from "@/lib/payments/providers/mtn-momo";
import { isCountryCode, normaliseDigits, parsePhone } from "@/lib/phone";
import { validatePlatformPayment } from "@/lib/repos/admin";
import {
  createProviderSubscriptionPayment,
  declareManualSubscriptionPayment,
  getProviderPaymentForCheck,
  MANUAL_PAYMENT_CHANNELS,
  markProviderPaymentFailed,
  markProviderPaymentRequested,
  recordProviderPaymentStatus,
  SubscriptionError,
  type ManualPaymentChannel,
} from "@/lib/repos/subscriptions";

export type SubscriptionPaymentState = { error?: string; ok?: boolean; paymentId?: string };
export type MomoPaymentState = {
  error?: string;
  message?: string;
  paymentId?: string;
  providerStatus?: string;
};

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

export async function startMomoSubscriptionPaymentAction(
  _previous: MomoPaymentState,
  formData: FormData,
): Promise<MomoPaymentState> {
  const session = await requireWorkshop("subscription.manage");
  const locale = await getLocale();
  const planId = String(formData.get("planId") ?? "");
  const amountRaw = String(formData.get("amount") ?? "");
  const currency = String(formData.get("currency") ?? "");
  const payerPhoneRaw = String(formData.get("payerPhone") ?? "");
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "") || randomUUID();

  if (!planId) return { error: "Offre introuvable." };
  if (!isCurrencyCode(currency)) return { error: "Devise invalide." };

  if (!isCountryCode(session.workshop.countryCode)) return { error: "Pays de l'atelier invalide." };
  const payerPhone = parsePhone(payerPhoneRaw, session.workshop.countryCode);
  if (!payerPhone.ok) return { error: payerPhone.error };

  let amount;
  try {
    amount = parseAmount(amountRaw, currency);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Montant invalide." };
  }

  const providerReferenceId = randomUUID();
  const externalId = `fileo-${Date.now()}`;
  const providerMoney = providerMoneyFor(amount);

  let payment: { paymentId: string; providerReferenceId: string; externalId: string } | null = null;
  try {
    payment = await createProviderSubscriptionPayment({
      workshopId: session.workshop.id,
      actorUserId: session.user.id,
      planId,
      amount,
      provider: "mtn_momo",
      providerReferenceId,
      providerAmount: providerMoney.amount,
      providerCurrency: providerMoney.currency,
      externalId,
      payerPhoneE164: payerPhone.e164,
      payerMsisdn: normaliseDigits(payerPhone.e164),
      idempotencyKey,
    });

    await requestToPay({
      referenceId: payment.providerReferenceId,
      amount: providerMoney.amount,
      currency: providerMoney.currency,
      externalId: payment.externalId,
      payerMsisdn: normaliseDigits(payerPhone.e164),
      payerMessage: "Paiement abonnement Filéo",
      payeeNote: "Abonnement Filéo",
    });

    await markProviderPaymentRequested({
      paymentId: payment.paymentId,
      workshopId: session.workshop.id,
      providerStatus: "PENDING",
    });
    revalidatePath(localePath(locale, "/atelier/abonnement"));
    return {
      paymentId: payment.paymentId,
      providerStatus: "PENDING",
      message: "Demande envoyée. Confirmez le paiement sur votre téléphone, puis vérifiez le statut.",
    };
  } catch (error) {
    if (payment?.paymentId) {
      await markProviderPaymentFailed({
        paymentId: payment.paymentId,
        workshopId: session.workshop.id,
        reason: error instanceof Error ? error.message : "Demande MTN MoMo refusée.",
        providerStatus: "FAILED",
      });
    }
    return {
      error: error instanceof Error ? error.message : "Impossible de lancer le paiement MTN MoMo.",
    };
  }
}

export async function checkMomoSubscriptionPaymentAction(
  _previous: MomoPaymentState,
  formData: FormData,
): Promise<MomoPaymentState> {
  const session = await requireWorkshop("subscription.manage");
  const locale = await getLocale();
  const paymentId = String(formData.get("paymentId") ?? "");
  if (!paymentId) return { error: "Paiement introuvable." };

  const payment = await getProviderPaymentForCheck({
    paymentId,
    workshopId: session.workshop.id,
    provider: "mtn_momo",
  });
  if (!payment) return { error: "Paiement MTN MoMo introuvable." };
  if (payment.status === "validated") {
    return { paymentId, providerStatus: "SUCCESSFUL", message: "Paiement déjà validé." };
  }
  if (payment.status !== "provider_pending") {
    return { error: "Ce paiement n'est plus en attente." };
  }

  try {
    const providerStatus = await getRequestToPayStatus(payment.provider_reference_id);
    await recordProviderPaymentStatus({
      paymentId,
      workshopId: session.workshop.id,
      providerStatus: providerStatus.status,
      payload: providerStatus,
    });

    if (providerStatus.status === "SUCCESSFUL") {
      await validatePlatformPayment({
        paymentId,
        reviewerUserId: session.user.id,
        note: "Validation automatique MTN MoMo.",
      });
      revalidatePath(localePath(locale, "/atelier/abonnement"));
      return {
        paymentId,
        providerStatus: providerStatus.status,
        message: "Paiement MTN MoMo confirmé. L'abonnement a été mis à jour.",
      };
    }

    if (providerStatus.status === "FAILED") {
      await markProviderPaymentFailed({
        paymentId,
        workshopId: session.workshop.id,
        reason: "Paiement MTN MoMo échoué.",
        providerStatus: providerStatus.status,
        payload: providerStatus,
      });
      revalidatePath(localePath(locale, "/atelier/abonnement"));
      return { paymentId, providerStatus: providerStatus.status, error: "Le paiement MTN MoMo a échoué." };
    }

    return {
      paymentId,
      providerStatus: providerStatus.status,
      message: "Paiement encore en attente chez MTN MoMo.",
    };
  } catch (error) {
    return {
      paymentId,
      error: error instanceof Error ? error.message : "Impossible de vérifier le statut MTN MoMo.",
    };
  }
}

function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
