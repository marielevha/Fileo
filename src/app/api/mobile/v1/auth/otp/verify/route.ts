import { mobileHandler, MobileApiError, ok, parseJsonBody, sessionPayload } from "@/lib/mobile/api";
import { isCountryCode, parsePhone } from "@/lib/phone";
import { authErrorCode, getSupabaseSession, supabaseMobileAuth, writeSupabaseAudit } from "@/lib/supabase/mobile-auth";

export const dynamic = "force-dynamic";

type VerifyBody = {
  country?: string;
  phone?: string;
  purpose?: "signup" | "password_reset";
  code?: string;
};

export async function POST(request: Request) {
  return mobileHandler(async () => {
    const body = await parseJsonBody<VerifyBody>(request);
    const country = String(body.country ?? "CG");
    if (!isCountryCode(country)) throw new MobileApiError(400, "validation_error", "Pays invalide.");
    if (body.purpose !== "signup" && body.purpose !== "password_reset") {
      throw new MobileApiError(400, "validation_error", "Motif OTP invalide.");
    }
    const phone = parsePhone(String(body.phone ?? ""), country);
    if (!phone.ok) throw new MobileApiError(400, "validation_error", phone.error);
    const code = String(body.code ?? "").trim();
    if (!/^\d{6}$/.test(code)) throw new MobileApiError(400, "validation_error", "Le code doit contenir 6 chiffres.");

    const { data, error } = await supabaseMobileAuth().auth.verifyOtp({
      phone: phone.e164,
      token: code,
      type: "sms",
    });
    if (error) {
      const mapped = authErrorCode(error);
      throw new MobileApiError(mapped.status, mapped.code, mapped.message);
    }
    if (!data.session) throw new MobileApiError(400, "invalid_otp", "Le code est invalide ou expire.");

    const session = await getSupabaseSession(data.session.access_token);
    if (!session) throw new MobileApiError(403, "account_unavailable", "Ce compte est indisponible.");
    await writeSupabaseAudit({
      workshopId: session.workshop?.id,
      actorUserId: session.user.id,
      action: "auth.phone_verify",
      entityKind: "user",
      entityId: session.user.id,
      after: { surface: "mobile", purpose: body.purpose },
    });

    const tokens = {
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      tokenType: "Bearer" as const,
      expiresAt: new Date(data.session.expires_at! * 1000).toISOString(),
    };
    if (body.purpose === "password_reset") return ok({ purpose: body.purpose, ...tokens });
    if (!session.workshop) throw new MobileApiError(403, "workshop_required", "Aucun atelier actif n'est associe a ce compte.");
    return ok({ purpose: body.purpose, ...tokens, ...sessionPayload(session as typeof session & { workshop: NonNullable<typeof session.workshop> }) });
  });
}
