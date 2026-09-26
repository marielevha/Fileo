import { mobileHandler, MobileApiError, ok, parseJsonBody, requireMobileSession } from "@/lib/mobile/api";
import { TeamError, updateTeamMember } from "@/lib/repos/team";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request, "team.manage");
    const { id } = await params;
    const body = await parseJsonBody<{ role?: unknown; status?: unknown; canViewMoney?: unknown }>(request);
    if (body.role !== "owner" && body.role !== "collaborator") throw new MobileApiError(400, "validation_error", "Rôle invalide.");
    if (body.status !== "active" && body.status !== "disabled") throw new MobileApiError(400, "validation_error", "Statut invalide.");
    if (typeof body.canViewMoney !== "boolean") throw new MobileApiError(400, "validation_error", "Accès financier invalide.");
    try {
      await updateTeamMember({ workshopId: session.workshop.id, actorUserId: session.user.id, membershipId: id, role: body.role, status: body.status, canViewMoney: body.canViewMoney });
    } catch (error) {
      if (error instanceof TeamError) throw new MobileApiError(400, "team_error", error.message);
      throw error;
    }
    return ok({ updated: true });
  });
}
