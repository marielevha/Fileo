import { listPlanningItems, listPlanningMembers, type PlanningAssigneeFilter, type PlanningStatusFilter } from "@/lib/repos/planning";
import { mobileHandler, ok, requireMobileSession, stringParam } from "@/lib/mobile/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request, "orders.read");
    const url = new URL(request.url);
    const status = stringParam(url, "status", "active") as PlanningStatusFilter;
    const assignee = stringParam(url, "assignee", "all") as PlanningAssigneeFilter;
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
