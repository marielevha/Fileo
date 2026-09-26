import { ITEM_STATUSES, OrderWriteError, updateOrderItem, type ItemStatus } from "@/lib/repos/orders";
import { mobileHandler, MobileApiError, ok, optionalDate, parseJsonBody, requireMobileSession, requiredString } from "@/lib/mobile/api";

export const dynamic = "force-dynamic";

type PatchItemBody = {
  status?: ItemStatus;
  dueDate?: string | null;
  reason?: string;
  rowVersion?: number;
};

export async function PATCH(request: Request, context: { params: Promise<{ id: string; itemId: string }> }) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request, "orders.write");
    const { id, itemId } = await context.params;
    const body = await parseJsonBody<PatchItemBody>(request);
    if (!ITEM_STATUSES.includes(body.status as ItemStatus)) {
      throw new MobileApiError(400, "validation_error", "Etat invalide.");
    }
    if (!Number.isInteger(body.rowVersion) || Number(body.rowVersion) < 0) {
      throw new MobileApiError(400, "validation_error", "Version de l'article invalide.");
    }
    try {
      const result = await updateOrderItem({
        workshopId: session.workshop.id,
        orderId: id,
        itemId,
        actorUserId: session.user.id,
        status: body.status as ItemStatus,
        dueDate: optionalDate(body.dueDate, "Date d'echeance"),
        reason: body.reason ? requiredString(body.reason, "Motif", 500) : "",
        expectedVersion: Number(body.rowVersion),
      });
      if (result === "not_found") throw new MobileApiError(404, "not_found", "Article introuvable.");
      if (result === "conflict") throw new MobileApiError(409, "conflict", "Cet article vient d'etre modifie. Rechargez la commande.");
      return ok({ updated: true });
    } catch (error) {
      if (error instanceof OrderWriteError) throw new MobileApiError(400, "order_write_error", error.message);
      throw error;
    }
  });
}
