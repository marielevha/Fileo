import { validatePasswordStrength } from "@/lib/auth/password";
import { mobileHandler, MobileApiError, ok, parseJsonBody } from "@/lib/mobile/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { writeSupabaseAudit } from "@/lib/supabase/mobile-auth";

export const dynamic = "force-dynamic";

type ResetBody = { accessToken?: string; password?: string };

export async function POST(request: Request) {
  return mobileHandler(async () => {
    const body = await parseJsonBody<ResetBody>(request);
    const accessToken = String(body.accessToken ?? "").trim();
    const password = String(body.password ?? "");
    const passwordError = validatePasswordStrength(password);
    if (passwordError) throw new MobileApiError(400, "weak_password", passwordError);
    if (!accessToken) throw new MobileApiError(400, "validation_error", "Session de reinitialisation manquante.");

    const admin = supabaseAdmin();
    const { data: authData, error: tokenError } = await admin.auth.getUser(accessToken);
    if (tokenError || !authData.user) throw new MobileApiError(401, "invalid_token", "La session de reinitialisation est invalide ou expiree.");
    const { data: profile, error: profileError } = await admin
      .from("app_users").select("id").eq("auth_user_id", authData.user.id).eq("status", "active").maybeSingle();
    if (profileError) throw profileError;
    if (!profile) throw new MobileApiError(403, "account_disabled", "Ce compte est indisponible.");

    const { error: updateError } = await admin.auth.admin.updateUserById(authData.user.id, { password });
    if (updateError) throw new MobileApiError(400, "password_update_failed", "Le mot de passe n'a pas pu etre modifie.");
    await writeSupabaseAudit({
      actorUserId: profile.id,
      action: "auth.password_reset",
      entityKind: "user",
      entityId: profile.id,
      after: { surface: "mobile" },
    });
    return ok({ passwordReset: true });
  });
}
