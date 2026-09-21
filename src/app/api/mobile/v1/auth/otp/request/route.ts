import { mobileHandler, MobileApiError, ok, parseJsonBody } from "@/lib/mobile/api";
import { isCountryCode, parsePhone } from "@/lib/phone";
import { authErrorCode, supabaseMobileAuth } from "@/lib/supabase/mobile-auth";

export const dynamic = "force-dynamic";

type OtpPurpose = "signup" | "password_reset";
type RequestBody = { country?: string; phone?: string; purpose?: OtpPurpose };

export async function POST(request: Request) {
  return mobileHandler(async () => {
    const body = await parseJsonBody<RequestBody>(request);
    const country = String(body.country ?? "CG");
    if (!isCountryCode(country)) throw new MobileApiError(400, "validation_error", "Pays invalide.");
    if (body.purpose !== "signup" && body.purpose !== "password_reset") {
      throw new MobileApiError(400, "validation_error", "Motif OTP invalide.");
    }
    const phone = parsePhone(String(body.phone ?? ""), country);
    if (!phone.ok) throw new MobileApiError(400, "validation_error", phone.error);

    const auth = supabaseMobileAuth().auth;
    const result = body.purpose === "signup"
      ? await auth.resend({ type: "sms", phone: phone.e164 })
      : await auth.signInWithOtp({ phone: phone.e164, options: { shouldCreateUser: false } });
    if (result.error) {
      const mapped = authErrorCode(result.error);
      throw new MobileApiError(mapped.status, mapped.code, mapped.message);
    }

    return ok({ requested: true, phone: phone.e164, purpose: body.purpose, resendAfter: new Date(Date.now() + 60_000).toISOString() });
  });
}
