import { mobileHandler, MobileApiError, ok, parseJsonBody } from "@/lib/mobile/api";
import { isCountryCode, parsePhone } from "@/lib/phone";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authErrorCode, supabaseMobileAuth } from "@/lib/supabase/mobile-auth";

export const dynamic = "force-dynamic";

type ForgotBody = { country?: string; phone?: string };

export async function POST(request: Request) {
  return mobileHandler(async () => {
    const body = await parseJsonBody<ForgotBody>(request);
    const country = String(body.country ?? "CG");
    if (!isCountryCode(country)) throw new MobileApiError(400, "validation_error", "Pays invalide.");
    const phone = parsePhone(String(body.phone ?? ""), country);
    if (!phone.ok) throw new MobileApiError(400, "validation_error", phone.error);

    const { data: profile, error: profileError } = await supabaseAdmin()
      .from("app_users").select("id").eq("phone_e164", phone.e164).eq("status", "active").maybeSingle();
    if (profileError) throw profileError;
    if (profile) {
      const { error } = await supabaseMobileAuth().auth.signInWithOtp({
        phone: phone.e164,
        options: { shouldCreateUser: false },
      });
      if (error) {
        const mapped = authErrorCode(error);
        throw new MobileApiError(mapped.status, mapped.code, mapped.message);
      }
    }

    return ok({ requested: true, phone: phone.e164, purpose: "password_reset", resendAfter: new Date(Date.now() + 60_000).toISOString() });
  });
}
