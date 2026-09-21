import { listOrderAttachmentsWithUrls } from "@/lib/repos/attachments";
import { cancelOrder, getOrder, OrderWriteError, updateOrderDetails } from "@/lib/repos/orders";
import { listMovements } from "@/lib/repos/payments";
import { mobileHandler, MobileApiError, ok, optionalDate, optionalString, parseJsonBody, requireMobileSession, requiredString } from "@/lib/mobile/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request, "orders.read");
    const { id } = await context.params;
    const order = await getOrder(session.workshop.id, id, session.workshop.canViewMoney);
    if (!order) throw new MobileApiError(404, "not_found", "Commande introuvable.");
    const [movements, attachments] = await Promise.all([
      session.workshop.canViewMoney ? listMovements(session.workshop.id, id) : Promise.resolve([]),
      listOrderAttachmentsWithUrls(session.workshop.id, id),
    ]);
    return ok({ ...order, movements, attachments });
  });
}

type PatchOrderBody = {
  action?: "update" | "cancel";
  promisedDate?: string | null;
  fittingDate?: string | null;
  instructions?: string | null;
  reason?: string;
};

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request, "orders.write");
    const { id } = await context.params;
    const body = await parseJsonBody<PatchOrderBody>(request);
    try {
      const found = body.action === "cancel"
        ? await cancelOrder({ workshopId: session.workshop.id, orderId: id, actorUserId: session.user.id, reason: requiredString(body.reason, "Motif", 500) })
        : await updateOrderDetails({
            workshopId: session.workshop.id,
            orderId: id,
            actorUserId: session.user.id,
            promisedDate: optionalDate(body.promisedDate, "Date promise"),
            fittingDate: optionalDate(body.fittingDate, "Date d'essayage"),
            instructions: optionalString(body.instructions, 2000),
          });
      if (!found) throw new MobileApiError(404, "not_found", "Commande introuvable.");
      return ok(await getOrder(session.workshop.id, id, session.workshop.canViewMoney));
    } catch (error) {
      if (error instanceof OrderWriteError) throw new MobileApiError(400, "order_write_error", error.message);
      throw error;
    }
  });
}
