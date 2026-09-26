import { randomUUID } from "node:crypto";
import { isCurrencyCode, money } from "@/lib/money";
import {
  integerAmount,
  mobileHandler,
  MobileApiError,
  ok,
  optionalDate,
  optionalString,
  parseJsonBody,
  requireMobileSession,
  requiredString,
} from "@/lib/mobile/api";
import { FinancialError, recordPayment, type MovementMethod } from "@/lib/repos/payments";

export const dynamic = "force-dynamic";

type PaymentBody = {
  orderId?: string;
  amount?: number;
  method?: MovementMethod;
  reference?: string | null;
  effectiveDate?: string;
  idempotencyKey?: string;
  pending?: boolean;
};

const METHODS: MovementMethod[] = ["cash", "mobile_money", "transfer", "other"];

export async function POST(request: Request) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request, "money.write");
    if (!isCurrencyCode(session.workshop.currency)) {
      throw new MobileApiError(400, "validation_error", "Devise atelier invalide.");
    }
    const body = await parseJsonBody<PaymentBody>(request);
    const method = body.method ?? "cash";
    if (!METHODS.includes(method)) throw new MobileApiError(400, "validation_error", "Moyen d'encaissement invalide.");
    const effectiveDate = optionalDate(body.effectiveDate, "Date d'encaissement");
    if (!effectiveDate) throw new MobileApiError(400, "validation_error", "Date d'encaissement obligatoire.");

    try {
      const result = await recordPayment({
        workshopId: session.workshop.id,
        actorUserId: session.user.id,
        orderId: requiredString(body.orderId, "Commande", 80),
        amount: money(integerAmount(body.amount, "Montant"), session.workshop.currency),
        method,
        reference: optionalString(body.reference, 120),
        effectiveDate,
        idempotencyKey: optionalString(body.idempotencyKey, 128) ?? `mobile:${randomUUID()}`,
        pending: Boolean(body.pending),
      });
      return ok(result);
    } catch (error) {
      if (error instanceof FinancialError) {
        throw new MobileApiError(400, "financial_error", error.message);
      }
      throw error;
    }
  });
}
