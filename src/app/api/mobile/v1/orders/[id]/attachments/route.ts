import { AttachmentUploadError, listOrderAttachmentsWithUrls, uploadOrderAttachments } from "@/lib/repos/attachments";
import { getOrder } from "@/lib/repos/orders";
import { attachmentFilesFromRequest, mobileHandler, MobileApiError, created, ok, requireMobileSession } from "@/lib/mobile/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request, "orders.read");
    const { id } = await context.params;
    if (!(await getOrder(session.workshop.id, id, false))) {
      throw new MobileApiError(404, "not_found", "Commande introuvable.");
    }
    return ok({ items: await listOrderAttachmentsWithUrls(session.workshop.id, id) });
  });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request, "orders.write");
    const { id } = await context.params;
    const summary = await getOrder(session.workshop.id, id, false);
    if (!summary) throw new MobileApiError(404, "not_found", "Commande introuvable.");
    const files = await attachmentFilesFromRequest(request);
    let attachments;
    try {
      attachments = await uploadOrderAttachments({
        workshopId: session.workshop.id,
        orderId: id,
        clientId: summary.order.client_id,
        actorUserId: session.user.id,
        files,
      });
    } catch (error) {
      if (error instanceof AttachmentUploadError) {
        throw new MobileApiError(400, "attachment_error", error.message);
      }
      throw error;
    }
    return created({ items: attachments });
  });
}
