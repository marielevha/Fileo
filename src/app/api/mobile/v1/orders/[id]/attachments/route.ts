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
    const attachmentId = request.headers.get("x-fileo-attachment-id");
    if (attachmentId && (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attachmentId) || files.length !== 1)) {
      throw new MobileApiError(400, "validation_error", "Identifiant de piece jointe invalide.");
    }
    let attachments;
    try {
      attachments = await uploadOrderAttachments({
        workshopId: session.workshop.id,
        orderId: id,
        clientId: summary.order.client_id,
        actorUserId: session.user.id,
        files,
        attachmentId: attachmentId ?? undefined,
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
