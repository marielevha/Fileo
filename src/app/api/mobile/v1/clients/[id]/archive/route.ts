import { archiveClient, getClient } from "@/lib/repos/clients";
import { mobileHandler, MobileApiError, ok, parseJsonBody, requireMobileSession } from "@/lib/mobile/api";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request, "clients.write");
    const { id } = await context.params;
    const body = await parseJsonBody<{ archived?: boolean }>(request);
    if (typeof body.archived !== "boolean") {
      throw new MobileApiError(400, "validation_error", "Etat d'archivage invalide.");
    }
    if (!(await getClient(session.workshop.id, id))) {
      throw new MobileApiError(404, "not_found", "Client introuvable.");
    }
    await archiveClient({
      workshopId: session.workshop.id,
      clientId: id,
      actorUserId: session.user.id,
      archived: body.archived,
    });
    return ok({ id, archived: body.archived });
  });
}
