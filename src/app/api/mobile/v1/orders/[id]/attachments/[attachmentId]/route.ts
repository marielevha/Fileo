import { deleteAttachment } from "@/lib/repos/attachments";
import { getOrder } from "@/lib/repos/orders";
import { mobileHandler, MobileApiError, ok, requireMobileSession } from "@/lib/mobile/api";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; attachmentId: string }> },
) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request, "orders.write");
    const { id, attachmentId } = await context.params;
    if (!(await getOrder(session.workshop.id, id, false))) {
      throw new MobileApiError(404, "not_found", "Commande introuvable.");
    }
    const deleted = await deleteAttachment({
      workshopId: session.workshop.id,
      orderId: id,
      attachmentId,
    });
    if (!deleted) throw new MobileApiError(404, "not_found", "Piece jointe introuvable.");
    return ok({ id: attachmentId, deleted: true });
  });
}
