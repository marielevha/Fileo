import { closeOrder, getOrder, OrderWriteError } from "@/lib/repos/orders";
import { mobileHandler, MobileApiError, ok, parseJsonBody, requireMobileSession } from "@/lib/mobile/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request, "money.write");
    const { id } = await context.params;
    const body = await parseJsonBody<{ articlesHandedOver?: boolean; paymentConfirmed?: boolean }>(request);
    if (body.articlesHandedOver !== true || body.paymentConfirmed !== true) {
      throw new MobileApiError(400, "confirmation_required", "Confirmez la remise des articles et le reglement du solde.");
    }
    try {
      const result = await closeOrder({ workshopId: session.workshop.id, orderId: id, actorUserId: session.user.id });
      if (result === "not_found") throw new MobileApiError(404, "not_found", "Commande introuvable.");
      return ok({ result, order: await getOrder(session.workshop.id, id, true) });
    } catch (error) {
      if (error instanceof OrderWriteError) throw new MobileApiError(409, "closure_blocked", error.message);
      throw error;
    }
  });
}
