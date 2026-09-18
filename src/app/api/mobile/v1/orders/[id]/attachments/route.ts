import { listOrderAttachmentsWithUrls, uploadOrderAttachments } from "@/lib/repos/attachments";
import { getOrder } from "@/lib/repos/orders";
import { mobileHandler, MobileApiError, created, ok, requireMobileSession } from "@/lib/mobile/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request, "orders.read");
    const { id } = await context.params;
    return ok({ items: await listOrderAttachmentsWithUrls(session.workshop.id, id) });
  });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request, "orders.write");
    const { id } = await context.params;
    const summary = await getOrder(session.workshop.id, id, false);
    if (!summary) throw new MobileApiError(404, "not_found", "Commande introuvable.");
    const form = await request.formData();
    const files = [...form.getAll("files"), ...form.getAll("orderFiles")]
      .filter((value): value is File => value instanceof File && value.size > 0);
    const attachments = await uploadOrderAttachments({
      workshopId: session.workshop.id,
      orderId: id,
      clientId: summary.order.client_id,
      actorUserId: session.user.id,
      files,
    });
    return created({ items: attachments });
  });
}
