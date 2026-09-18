import { listOrderAttachmentsWithUrls } from "@/lib/repos/attachments";
import { getOrder } from "@/lib/repos/orders";
import { listMovements } from "@/lib/repos/payments";
import { mobileHandler, MobileApiError, ok, requireMobileSession } from "@/lib/mobile/api";

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
