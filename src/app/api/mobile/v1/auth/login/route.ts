import { recordAudit } from "@/lib/audit";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken, getSessionByToken, parsePlatformRoles } from "@/lib/auth/session";
import { collection } from "@/lib/db";
import { mobileHandler, MobileApiError, ok, parseJsonBody, sessionPayload } from "@/lib/mobile/api";
import { isCountryCode, parsePhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

type LoginBody = {
  country?: string;
  phone?: string;
  password?: string;
  workshopId?: string | null;
};

export async function POST(request: Request) {
  return mobileHandler(async () => {
    const body = await parseJsonBody<LoginBody>(request);
    const country = String(body.country ?? "CG");
    const rawPhone = String(body.phone ?? "");
    const password = String(body.password ?? "");

    if (!isCountryCode(country)) throw new MobileApiError(400, "validation_error", "Pays invalide.");
    const phone = parsePhone(rawPhone, country);
    if (!phone.ok) throw new MobileApiError(400, "validation_error", phone.error);

    const users = await collection("users");
    const user = await users.findOne(
      { phone_e164: phone.e164 },
      { projection: { id: 1, password_hash: 1, status: 1, platform_roles: 1 } },
    );
    const generic = new MobileApiError(401, "invalid_credentials", "Numero de telephone ou mot de passe incorrect.");
    if (!user) throw generic;
    if (!(await verifyPassword(password, String(user.password_hash ?? "")))) throw generic;
    if (user.status !== "active") throw new MobileApiError(403, "account_disabled", "Ce compte est desactive.");

    const { token, expiresAt } = await createSessionToken(String(user.id), {
      workshopId: body.workshopId ?? null,
      userAgent: request.headers.get("user-agent"),
    });
    await recordAudit({
      actorUserId: String(user.id),
      action: "auth.login",
      entityKind: "user",
      entityId: String(user.id),
      after: { surface: "mobile", platformRoles: parsePlatformRoles(String(user.platform_roles ?? "[]")) },
    });

    const session = await getSessionByToken(token);
    if (!session?.workshop) throw new MobileApiError(403, "workshop_required", "Aucun atelier actif n'est associe a ce compte.");

    return ok({
      token,
      tokenType: "Bearer",
      expiresAt,
      ...sessionPayload(session as typeof session & { workshop: NonNullable<typeof session.workshop> }),
    });
  });
}
