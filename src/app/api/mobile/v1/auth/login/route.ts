import { mobileHandler, MobileApiError, ok, parseJsonBody, sessionPayload } from "@/lib/mobile/api";
import { isCountryCode, parsePhone } from "@/lib/phone";
import { authErrorCode, getSupabaseSession, signInWithPasswordAndMigrate, writeSupabaseAudit } from "@/lib/supabase/mobile-auth";

export const dynamic = "force-dynamic";

type LoginBody = {
  country?: string;
  phone?: string;
  password?: string;
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

    const { data, error } = await signInWithPasswordAndMigrate(phone.e164, password);
    if (error) {
      const mapped = authErrorCode(error);
      throw new MobileApiError(mapped.status, mapped.code, mapped.message);
    }
    if (!data.session) throw new MobileApiError(401, "invalid_credentials", "Numero de telephone ou mot de passe incorrect.");

    const session = await getSupabaseSession(data.session.access_token);
    if (!session?.workshop) throw new MobileApiError(403, "workshop_required", "Aucun atelier actif n'est associe a ce compte.");
    await writeSupabaseAudit({
      workshopId: session.workshop.id,
      actorUserId: session.user.id,
      action: "auth.login",
      entityKind: "user",
      entityId: session.user.id,
      after: { surface: "mobile" },
    });

    return ok({
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      tokenType: "Bearer",
      expiresAt: new Date(data.session.expires_at! * 1000).toISOString(),
      ...sessionPayload(session as typeof session & { workshop: NonNullable<typeof session.workshop> }),
    });
  });
}
