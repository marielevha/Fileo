"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { requireWorkshop } from "@/lib/auth/guards";
import { localePath } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/request";
import { isCurrencyCode, money, parseAmount } from "@/lib/money";
import { isCountryCode, parsePhone } from "@/lib/phone";
import { createClient } from "@/lib/repos/clients";
import {
  createOrder,
  OrderWriteError,
  type CreateOrderItemInput,
  type CreateOrderInput,
  type InitialPaymentMethod,
  type OrderItemWorkType,
} from "@/lib/repos/orders";

export type OrderFormState = {
  error?: string;
  success?: boolean;
  orderId?: string;
  reference?: string;
};

const METHODS: InitialPaymentMethod[] = ["cash", "mobile_money", "transfer", "other"];
const WORK_TYPES: OrderItemWorkType[] = ["creation", "retouche"];

function optional(value: FormDataEntryValue | null, maxLength = 1000) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, maxLength) : null;
}

function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function optionalDate(value: FormDataEntryValue | null, label: string) {
  const text = String(value ?? "").trim();
  if (!text) return { value: null } as const;
  if (!isDate(text)) return { error: `${label} est invalide.` } as const;
  return { value: text } as const;
}

function parseQuantity(value: FormDataEntryValue | null) {
  const quantity = Number.parseInt(String(value ?? "1"), 10);
  return Number.isSafeInteger(quantity) && quantity > 0 ? quantity : null;
}

function parseMeasurementLines(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return {};
  const entries: Record<string, string> = {};
  for (const [lineIndex, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line) continue;
    const separator = line.includes(":") ? line.indexOf(":") : line.indexOf("=");
    if (separator <= 0) {
      throw new Error(`La mesure ligne ${lineIndex + 1} doit etre au format "nom: valeur".`);
    }
    const key = line.slice(0, separator).trim().slice(0, 80);
    const measurementValue = line.slice(separator + 1).trim().slice(0, 80);
    if (!key || !measurementValue) {
      throw new Error(`La mesure ligne ${lineIndex + 1} doit contenir un nom et une valeur.`);
    }
    entries[key] = measurementValue;
  }
  return entries;
}

export async function createOrderAction(
  _previous: OrderFormState,
  formData: FormData,
): Promise<OrderFormState> {
  const session = await requireWorkshop("orders.write");
  const locale = await getLocale();
  const currency = session.workshop.currency;
  if (!isCurrencyCode(currency)) return { error: "La devise de l'atelier est invalide." };

  const clientModeValues = formData.getAll("clientMode");
  const clientMode = String(clientModeValues.at(-1) ?? "existing");
  let clientId = String(formData.get("clientId") ?? "").trim();
  if (clientMode === "new") {
    const displayNameValues = formData.getAll("newClientDisplayName");
    const phoneValues = formData.getAll("newClientPhone");
    const displayName = String(displayNameValues.at(-1) ?? "").trim();
    if (displayName.length < 2 || displayName.length > 120) {
      return { error: "Le nom du nouveau client doit contenir entre 2 et 120 caracteres." };
    }
    if (!isCountryCode(session.workshop.countryCode)) {
      return { error: "Le pays de l'atelier est invalide." };
    }
    const rawPhone = optional(phoneValues.at(-1) ?? null, 40);
    const phone = rawPhone ? parsePhone(rawPhone, session.workshop.countryCode) : null;
    if (phone && !phone.ok) return { error: phone.error };
    clientId = await createClient({
      workshopId: session.workshop.id,
      actorUserId: session.user.id,
      displayName,
      phoneE164: phone?.ok ? phone.e164 : null,
    });
  } else if (!clientId) {
    return { error: "Selectionnez un client." };
  }

  const promisedDate = optionalDate(formData.get("promisedDate"), "La date promise");
  if ("error" in promisedDate) return { error: promisedDate.error };
  const fittingDate = optionalDate(formData.get("fittingDate"), "La date d'essayage");
  if ("error" in fittingDate) return { error: fittingDate.error };

  const categories = formData.getAll("itemCategory");
  const descriptions = formData.getAll("itemDescription");
  const workTypes = formData.getAll("itemWorkType");
  const wearerNames = formData.getAll("itemWearerName");
  const wearerRelations = formData.getAll("itemWearerRelation");
  const measurementTexts = formData.getAll("itemMeasurements");
  const quantities = formData.getAll("itemQuantity");
  const prices = formData.getAll("itemUnitPrice");
  const dueDates = formData.getAll("itemDueDate");
  const maxRows = Math.max(
    categories.length,
    descriptions.length,
    workTypes.length,
    wearerNames.length,
    wearerRelations.length,
    measurementTexts.length,
    quantities.length,
    prices.length,
    dueDates.length,
  );
  const items: CreateOrderItemInput[] = [];

  for (let index = 0; index < maxRows; index += 1) {
    const category = String(categories[index] ?? "").trim();
    const description = String(descriptions[index] ?? "").trim();
    const workType = String(workTypes[index] ?? "creation") as OrderItemWorkType;
    const wearerName = optional(wearerNames[index] ?? null, 120);
    const wearerRelation = optional(wearerRelations[index] ?? null, 80);
    const hasAnyValue = Boolean(
      category ||
        description ||
        wearerName ||
        wearerRelation ||
        String(measurementTexts[index] ?? "").trim() ||
        String(dueDates[index] ?? "").trim(),
    );
    if (!hasAnyValue) continue;
    if (category.length < 2 || category.length > 80) {
      return { error: `La categorie de la ligne ${index + 1} doit contenir entre 2 et 80 caracteres.` };
    }
    if (description.length < 2 || description.length > 500) {
      return { error: `La description de la ligne ${index + 1} doit contenir entre 2 et 500 caracteres.` };
    }
    if (!WORK_TYPES.includes(workType)) {
      return { error: `Le type de travail de la ligne ${index + 1} est invalide.` };
    }
    const quantity = parseQuantity(quantities[index] ?? null);
    if (!quantity) return { error: `La quantite de la ligne ${index + 1} est invalide.` };
    const dueDate = optionalDate(dueDates[index] ?? null, `L'echeance de la ligne ${index + 1}`);
    if ("error" in dueDate) return { error: dueDate.error };
    let measurementValues: Record<string, string>;
    try {
      measurementValues = parseMeasurementLines(measurementTexts[index] ?? null);
    } catch (error) {
      return { error: error instanceof Error ? error.message : `Les mesures de la ligne ${index + 1} sont invalides.` };
    }

    let unitPrice = money(0, currency);
    if (session.workshop.canViewMoney) {
      try {
        unitPrice = parseAmount(String(prices[index] ?? "0"), currency);
      } catch (error) {
        return { error: error instanceof Error ? error.message : `Le prix de la ligne ${index + 1} est invalide.` };
      }
      if (unitPrice.amount < 0) return { error: `Le prix de la ligne ${index + 1} ne peut pas etre negatif.` };
    }

    items.push({
      category,
      description,
      workType,
      wearerName,
      wearerRelation,
      quantity,
      unitPrice,
      dueDate: dueDate.value,
      measurementValues,
      measurementNotes: null,
    });
  }

  if (items.length === 0) return { error: "Ajoutez au moins un article a la commande." };

  let discount = money(0, currency);
  let discountReason: string | null = null;
  let initialPayment: CreateOrderInput["initialPayment"] = null;
  let globalOrderTotal = money(0, currency);
  if (session.workshop.canViewMoney) {
    const orderTotalValues = formData.getAll("orderTotalAmount");
    const orderTotalText = String(orderTotalValues.at(-1) ?? "").trim();
    if (orderTotalText) {
      try {
        globalOrderTotal = parseAmount(orderTotalText, currency);
      } catch (error) {
        return { error: error instanceof Error ? error.message : "Le montant global de la commande est invalide." };
      }
      if (globalOrderTotal.amount < 0) return { error: "Le montant global ne peut pas etre negatif." };
    }

    try {
      discount = parseAmount(String(formData.get("discountAmount") ?? "0"), currency);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "La reduction est invalide." };
    }
    if (discount.amount < 0) return { error: "La reduction ne peut pas etre negative." };
    discountReason = optional(formData.get("discountReason"), 160);

    const initialPaymentAmountText = String(formData.get("initialPaymentAmount") ?? "").trim();
    if (initialPaymentAmountText) {
      let amount;
      try {
        amount = parseAmount(initialPaymentAmountText, currency);
      } catch (error) {
        return { error: error instanceof Error ? error.message : "L'acompte est invalide." };
      }
      if (amount.amount <= 0) return { error: "L'acompte doit etre strictement positif." };

      const method = String(formData.get("initialPaymentMethod") ?? "") as InitialPaymentMethod;
      if (!METHODS.includes(method)) return { error: "Le moyen d'encaissement est invalide." };

      const effectiveDate = String(formData.get("initialPaymentDate") ?? "").trim();
      if (!isDate(effectiveDate)) return { error: "La date de l'acompte est invalide." };
      if (effectiveDate > new Date().toISOString().slice(0, 10)) {
        return { error: "La date de l'acompte ne peut pas etre dans le futur." };
      }

      const idempotencyKey = String(formData.get("paymentIdempotencyKey") ?? randomUUID()).trim();
      if (!/^[A-Za-z0-9:_-]{8,128}$/.test(idempotencyKey)) {
        return { error: "La cle de securite de l'encaissement est invalide. Rechargez la page." };
      }

      initialPayment = {
        amount,
        method,
        reference: optional(formData.get("initialPaymentReference"), 120),
        effectiveDate,
        idempotencyKey,
      };
    }
  }

  if (session.workshop.canViewMoney && items.length > 0) {
    const itemTotal = items.reduce((total, item) => total + item.unitPrice.amount * item.quantity, 0);
    if (itemTotal === 0 && globalOrderTotal.amount > 0) {
      items[0] = { ...items[0], unitPrice: globalOrderTotal };
    }
  }

  let result;
  try {
    result = await createOrder({
      workshopId: session.workshop.id,
      actorUserId: session.user.id,
      clientId,
      currency,
      discount,
      discountReason,
      instructions: optional(formData.get("instructions"), 2000),
      promisedDate: promisedDate.value,
      fittingDate: fittingDate.value,
      items,
      initialPayment,
    });
  } catch (error) {
    if (error instanceof OrderWriteError) return { error: error.message };
    throw error;
  }

  revalidatePath(localePath(locale, "/atelier/commandes"));
  return {
    success: true,
    orderId: result.orderId,
    reference: result.reference,
  };
}
