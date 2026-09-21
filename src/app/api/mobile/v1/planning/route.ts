import { listPlanningItems, listPlanningMembers, type PlanningAssigneeFilter, type PlanningStatusFilter } from "@/lib/repos/planning";
import { ITEM_STATUSES } from "@/lib/repos/orders";
import { mobileHandler, MobileApiError, ok, requireMobileSession, stringParam } from "@/lib/mobile/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request, "orders.read");
    const url = new URL(request.url);
    const status = stringParam(url, "status", "active") as PlanningStatusFilter;
    const assignee = stringParam(url, "assignee", "all") as PlanningAssigneeFilter;
    if (status !== "active" && status !== "all" && !ITEM_STATUSES.includes(status)) {
      throw new MobileApiError(400, "validation_error", "Filtre de statut invalide.");
    }
    const [items, members] = await Promise.all([
      listPlanningItems(session.workshop.id, {
        search: stringParam(url, "q"),
        status,
        assignee,
      }),
      listPlanningMembers(session.workshop.id),
    ]);
    return ok({ items, members });
  });
}
