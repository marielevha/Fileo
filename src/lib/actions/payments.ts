"use server";

import { redirect } from "next/navigation";
import { requireWorkshop } from "@/lib/auth/guards";
import { localePath } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/request";
import { isCurrencyCode, parseAmount } from "@/lib/money";
import {
  FinancialError,
  recordPayment,
  type MovementMethod,
} from "@/lib/repos/payments";
import { getOrder } from "@/lib/repos/orders";

export type PaymentFormState = { error?: string };

const METHODS: MovementMethod[] = ["cash", "mobile_money", "transfer", "other"];

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function recordPaymentAction(
  orderId: string,
  _previous: PaymentFormState,
  formData: FormData,
): Promise<PaymentFormState> {
  const session = await requireWorkshop("money.write");
  const summary = getOrder(session.workshop.id, orderId, true);
  if (!summary) return { error: "Cette commande n'existe plus ou n'est pas accessible." };

  const currency = summary.order.currency;
  if (!isCurrencyCode(currency)) return { error: "La devise de la commande est invalide." };

  let amount;
  try {
    amount = parseAmount(String(formData.get("amount") ?? ""), currency);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Le montant est invalide." };
  }
  if (amount.amount <= 0) return { error: "Le montant doit être strictement positif." };

  const method = String(formData.get("method") ?? "") as MovementMethod;
  if (!METHODS.includes(method)) return { error: "Le moyen d'encaissement est invalide." };

  const effectiveDate = String(formData.get("effectiveDate") ?? "").trim();
  if (!isDate(effectiveDate)) return { error: "La date d'encaissement est invalide." };
  if (effectiveDate > new Date().toISOString().slice(0, 10)) {
    return { error: "La date d'encaissement ne peut pas être dans le futur." };
  }

  const reference = String(formData.get("reference") ?? "").trim().slice(0, 120) || null;
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "").trim();
  if (!/^[A-Za-z0-9:_-]{8,128}$/.test(idempotencyKey)) {
    return { error: "La clé de sécurité de l'opération est invalide. Rechargez la page." };
  }

  try {
    recordPayment({
      workshopId: session.workshop.id,
      orderId,
      actorUserId: session.user.id,
      amount,
      method,
      reference,
      effectiveDate,
      idempotencyKey,
    });
  } catch (error) {
    if (error instanceof FinancialError) return { error: error.message };
    throw error;
  }

  const locale = await getLocale();
  redirect(`${localePath(locale, `/atelier/commandes/${orderId}`)}?encaissement=ok`);
}
