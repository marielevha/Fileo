import { mobileHandler, MobileApiError, ok, optionalDate, parseJsonBody, requireMobileSession, requiredString } from "@/lib/mobile/api";
import { ITEM_STATUSES, OrderWriteError, updateOrderItem, type ItemStatus } from "@/lib/repos/orders";
import { getPlanningItemForUpdate, isActivePlanningMember } from "@/lib/repos/planning";

export const dynamic = "force-dynamic";

type PatchPlanningBody = {
  status?: ItemStatus;
  dueDate?: string | null;
  assigneeId?: string | null;
  reason?: string;
  rowVersion?: number;
};

export async function PATCH(request: Request, context: { params: Promise<{ itemId: string }> }) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request, "orders.write");
    const { itemId } = await context.params;
    const body = await parseJsonBody<PatchPlanningBody>(request);
    const item = await getPlanningItemForUpdate(session.workshop.id, itemId);
    if (!item) throw new MobileApiError(404, "not_found", "Tache introuvable.");
    if (!ITEM_STATUSES.includes(body.status as ItemStatus)) throw new MobileApiError(400, "validation_error", "Etat invalide.");
    if (!Number.isInteger(body.rowVersion) || Number(body.rowVersion) < 0) throw new MobileApiError(400, "validation_error", "Version invalide.");
    const assigneeId = body.assigneeId ? requiredString(body.assigneeId, "Collaborateur", 80) : null;
    if (assigneeId && !(await isActivePlanningMember(session.workshop.id, assigneeId))) {
      throw new MobileApiError(400, "validation_error", "Ce collaborateur n'est plus actif.");
    }
    try {
      const result = await updateOrderItem({
        workshopId: session.workshop.id,
        orderId: item.order_id,
        itemId,
        actorUserId: session.user.id,
        status: body.status as ItemStatus,
        dueDate: optionalDate(body.dueDate, "Date d'echeance"),
        assigneeId,
        reason: body.reason ? requiredString(body.reason, "Motif", 500) : "",
        expectedVersion: Number(body.rowVersion),
      });
      if (result === "conflict") throw new MobileApiError(409, "conflict", "Cette tache vient d'etre modifiee. Rechargez le planning.");
      if (result === "not_found") throw new MobileApiError(404, "not_found", "Tache introuvable.");
      return ok({ updated: true });
    } catch (error) {
      if (error instanceof OrderWriteError) throw new MobileApiError(400, "order_write_error", error.message);
      throw error;
    }
  });
}
