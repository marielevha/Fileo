import { randomUUID } from "node:crypto";
import { validatePasswordStrength } from "@/lib/auth/password";
import { isCurrencyCode } from "@/lib/money";
import { created, mobileHandler, MobileApiError, parseJsonBody } from "@/lib/mobile/api";
import { COUNTRIES, isCountryCode, parsePhone } from "@/lib/phone";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { authErrorCode, phoneAuthEmail, supabaseMobileAuth, writeSupabaseAudit } from "@/lib/supabase/mobile-auth";

export const dynamic = "force-dynamic";

type RegisterBody = {
  fullName?: string;
  country?: string;
  phone?: string;
  password?: string;
  workshopName?: string;
  city?: string;
  currency?: string;
  planCode?: string;
  termsAccepted?: boolean;
};

const slugify = (value: string) => value
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "atelier";

export async function POST(request: Request) {
  return mobileHandler(async () => {
    const body = await parseJsonBody<RegisterBody>(request);
    const fullName = String(body.fullName ?? "").trim();
    const country = String(body.country ?? "CG");
    const password = String(body.password ?? "");
    const workshopName = String(body.workshopName ?? "").trim();
    const city = String(body.city ?? "").trim();
    const currency = String(body.currency ?? "");
    const planCode = String(body.planCode ?? "").trim();

    if (fullName.length < 2) throw new MobileApiError(400, "validation_error", "Merci d'indiquer votre nom.");
    if (!isCountryCode(country)) throw new MobileApiError(400, "validation_error", "Pays invalide.");
    if (body.termsAccepted !== true) throw new MobileApiError(400, "terms_required", "Vous devez accepter les conditions pour continuer.");
    const phone = parsePhone(String(body.phone ?? ""), country);
    if (!phone.ok) throw new MobileApiError(400, "validation_error", phone.error);
    const passwordError = validatePasswordStrength(password);
    if (passwordError) throw new MobileApiError(400, "weak_password", passwordError);
    if (workshopName.length < 2) throw new MobileApiError(400, "validation_error", "Merci d'indiquer le nom de votre atelier.");
    if (!isCurrencyCode(currency)) throw new MobileApiError(400, "validation_error", "Devise invalide.");

    const admin = supabaseAdmin();
    let planQuery = admin.from("plans").select("id")
      .eq("country_code", country).eq("status", "active")
      .order("price_amount", { ascending: true }).order("version", { ascending: false }).limit(1);
    if (planCode) planQuery = planQuery.eq("code", planCode);
    const { data: plan, error: planError } = await planQuery.maybeSingle();
    if (planError) throw planError;
    if (!plan) throw new MobileApiError(400, "plan_unavailable", "L'offre selectionnee n'est pas disponible pour ce pays.");

    const { data: signup, error: signupError } = await supabaseMobileAuth().auth.signUp({
      phone: phone.e164,
      password,
      options: { data: { full_name: fullName } },
    });
    let authUser = signup.user;
    let requiresVerification = !signup.session;
    if (signupError?.code === "phone_provider_disabled") {
      const fallback = await admin.auth.admin.createUser({
        email: phoneAuthEmail(phone.e164),
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, phone_e164: phone.e164 },
      });
      if (fallback.error) {
        throw new MobileApiError(409, "account_exists", "Un compte existe deja avec ce numero.");
      }
      authUser = fallback.data.user;
      requiresVerification = false;
    } else if (signupError) {
      const mapped = authErrorCode(signupError);
      throw new MobileApiError(mapped.status, mapped.code, mapped.message);
    }
    if (!authUser || authUser.identities?.length === 0) {
      throw new MobileApiError(409, "account_exists", "Un compte existe deja avec ce numero.");
    }

    let appUserId: string | null = null;
    let workshopId: string | null = null;
    try {
      const { data: appUser, error: userError } = await admin.from("app_users").insert({
        auth_user_id: authUser.id,
        full_name: fullName,
        phone_e164: phone.e164,
        status: "active",
        platform_roles: [],
      }).select("id").single();
      if (userError) throw userError;
      appUserId = appUser.id;

      const { data: workshop, error: workshopError } = await admin.from("workshops").insert({
        owner_user_id: appUser.id,
        name: workshopName,
        slug: `${slugify(workshopName)}-${randomUUID().slice(0, 8)}`,
        country_code: country,
        city: city || null,
        phone_e164: phone.e164,
        currency,
        timezone: COUNTRIES[country].defaultTimezone,
        status: "active",
      }).select("id").single();
      if (workshopError) throw workshopError;
      workshopId = workshop.id;

      const trialEnd = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
      const { error: membershipError } = await admin.from("memberships").insert({
        workshop_id: workshop.id,
        user_id: appUser.id,
        role: "owner",
        can_view_money: true,
        status: "active",
        joined_at: new Date().toISOString(),
      });
      if (membershipError) throw membershipError;
      const { error: subscriptionError } = await admin.from("subscriptions").insert({
        workshop_id: workshop.id,
        current_plan_id: plan.id,
        status: "trialing",
        trial_ends_at: trialEnd,
        current_period_end: trialEnd,
      });
      if (subscriptionError) throw subscriptionError;
      await writeSupabaseAudit({
        workshopId: workshop.id,
        actorUserId: appUser.id,
        action: "auth.register",
        entityKind: "user",
        entityId: appUser.id,
        after: { surface: "mobile", phoneVerified: Boolean(authUser.phone_confirmed_at), smsProviderEnabled: !signupError },
      });
    } catch (error) {
      if (workshopId) await admin.from("workshops").delete().eq("id", workshopId);
      if (appUserId) await admin.from("app_users").delete().eq("id", appUserId);
      await admin.auth.admin.deleteUser(authUser.id);
      throw error;
    }

    return created({
      userId: appUserId,
      workshopId,
      phone: phone.e164,
      requiresVerification,
      resendAfter: new Date(Date.now() + 60_000).toISOString(),
    });
  });
}
