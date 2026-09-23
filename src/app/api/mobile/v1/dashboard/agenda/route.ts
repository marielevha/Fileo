import { listAgendaPage, type AgendaFilter } from "@/lib/repos/dashboard";
import { intParam, mobileHandler, MobileApiError, ok, requireMobileSession, stringParam } from "@/lib/mobile/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request, "orders.read");
    const url = new URL(request.url);
    const filter = stringParam(url, "filter") as AgendaFilter;
    if (!["today", "late", "ready", "week"].includes(filter)) {
      throw new MobileApiError(400, "validation_error", "Filtre d'echeance invalide.");
    }
    return ok(await listAgendaPage(session.workshop.id, filter, intParam(url, "page", 1, 1, 100000)));
  });
}
