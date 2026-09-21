import { isCountryCode, parsePhone } from "@/lib/phone";
import { intParam, mobileHandler, MobileApiError, ok, parseJsonBody, requireMobileSession, requiredString } from "@/lib/mobile/api";
import { addExistingMember, listTeamMembers, TeamError } from "@/lib/repos/team";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request, "team.manage");
    return ok(await listTeamMembers(session.workshop.id, { page: intParam(new URL(request.url), "page", 1), pageSize: 10 }));
  });
}

export async function POST(request: Request) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request, "team.manage");
    const body = await parseJsonBody<{ phone?: unknown; role?: unknown; canViewMoney?: unknown }>(request);
    if (!isCountryCode(session.workshop.countryCode)) throw new MobileApiError(400, "validation_error", "Pays de l'atelier invalide.");
    const phone = parsePhone(requiredString(body.phone, "Téléphone", 30), session.workshop.countryCode);
    if (!phone.ok) throw new MobileApiError(400, "validation_error", phone.error);
    if (body.role !== "owner" && body.role !== "collaborator") throw new MobileApiError(400, "validation_error", "Rôle invalide.");
    if (typeof body.canViewMoney !== "boolean") throw new MobileApiError(400, "validation_error", "Accès financier invalide.");
    try {
      await addExistingMember({ workshopId: session.workshop.id, actorUserId: session.user.id, phoneE164: phone.e164, role: body.role, canViewMoney: body.canViewMoney });
    } catch (error) {
      if (error instanceof TeamError) throw new MobileApiError(400, "team_error", error.message);
      throw error;
    }
    return ok({ added: true });
  });
}
