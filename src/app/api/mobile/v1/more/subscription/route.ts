import { randomUUID } from "node:crypto";
import { isCurrencyCode } from "@/lib/money";
import { mobileHandler, MobileApiError, ok, parseJsonBody, requireMobileSession, requiredString } from "@/lib/mobile/api";
import { declareManualSubscriptionPayment, getSubscriptionOverview, MANUAL_PAYMENT_CHANNELS, SubscriptionError, type ManualPaymentChannel } from "@/lib/repos/subscriptions";

export const dynamic = "force-dynamic";

async function overview(request: Request) {
  const session = await requireMobileSession(request, "subscription.manage");
  if (!isCurrencyCode(session.workshop.currency)) throw new MobileApiError(400, "validation_error", "Devise invalide.");
  const data = await getSubscriptionOverview({ workshopId: session.workshop.id, countryCode: session.workshop.countryCode, currency: session.workshop.currency });
  return { session, data };
}

export async function GET(request: Request) {
  return mobileHandler(async () => ok((await overview(request)).data));
}

export async function POST(request: Request) {
  return mobileHandler(async () => {
    const { session, data } = await overview(request);
    const body = await parseJsonBody<{ planId?: unknown; channel?: unknown; reference?: unknown }>(request);
    const plan = data.availablePlans.find((item) => item.id === body.planId);
    if (!plan) throw new MobileApiError(400, "validation_error", "Offre introuvable.");
    if (!MANUAL_PAYMENT_CHANNELS.includes(body.channel as ManualPaymentChannel)) throw new MobileApiError(400, "validation_error", "Moyen de paiement invalide.");
    const reference = requiredString(body.reference, "Référence de paiement", 120);
    try {
      const paymentId = await declareManualSubscriptionPayment({ workshopId: session.workshop.id, actorUserId: session.user.id, planId: plan.id, amount: plan.price, channel: body.channel as ManualPaymentChannel, externalReference: reference, declaredAt: new Date().toISOString().slice(0, 10), idempotencyKey: randomUUID() });
      return ok({ paymentId });
    } catch (error) {
      if (error instanceof SubscriptionError) throw new MobileApiError(400, "subscription_error", error.message);
      throw error;
    }
  });
}
