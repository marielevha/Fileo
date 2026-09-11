"use server";

import { redirect } from "next/navigation";
import { collection, newId, nowIso, withTransaction } from "@/lib/db";
import { hashPassword, validatePasswordStrength, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession, getSession, parsePlatformRoles } from "@/lib/auth/session";
import { recordAudit } from "@/lib/audit";
import { COUNTRIES, isCountryCode, parsePhone, type CountryCode } from "@/lib/phone";
import { isCurrencyCode } from "@/lib/money";
import { canInAdmin } from "@/lib/permissions";

/** Shape returned to every auth form via useActionState. */
export type FormState = { error?: string; ok?: boolean };

/* ---------------------------------------------------------------
   AUTH-02 — Connexion
   --------------------------------------------------------------- */

export async function signIn(_prev: FormState, formData: FormData): Promise<FormState> {
  const country = String(formData.get("country") ?? "CG");
  const rawPhone = String(formData.get("phone") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!isCountryCode(country)) return { error: "Pays invalide." };

  const phone = parsePhone(rawPhone, country);
  if (!phone.ok) return { error: phone.error };

  const users = await collection("users");
  const user = await users.findOne(
    { phone_e164: phone.e164 },
    { projection: { id: 1, password_hash: 1, status: 1, platform_roles: 1 } },
  );

  // Same message whether the number is unknown or the password is wrong:
  // an attacker must not be able to enumerate accounts.
  const generic = { error: "Numéro de téléphone ou mot de passe incorrect." };

  if (!user) return generic;
  if (!(await verifyPassword(password, user.password_hash))) return generic;
  if (user.status !== "active") return { error: "Ce compte est désactivé." };

  await createSession(user.id);
  await recordAudit({ actorUserId: String(user.id), action: "auth.login", entityKind: "user", entityId: String(user.id) });

  const platformRoles = parsePlatformRoles(String(user.platform_roles));
  const destination = canInAdmin(
    { userId: String(user.id), platformRoles },
    "admin.dashboard",
  )
    ? "/admin"
    : "/atelier";

  redirect(destination);
}

/* ---------------------------------------------------------------
   AUTH-01 — Inscription + création d'atelier (§7.1, §7.2)
   --------------------------------------------------------------- */

export async function signUp(_prev: FormState, formData: FormData): Promise<FormState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const country = String(formData.get("country") ?? "CG");
  const rawPhone = String(formData.get("phone") ?? "");
  const password = String(formData.get("password") ?? "");
  const workshopName = String(formData.get("workshopName") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const currency = String(formData.get("currency") ?? "");
  const planCode = String(formData.get("planCode") ?? "").trim();
  const accepted = formData.get("terms") === "on";

  if (fullName.length < 2) return { error: "Merci d'indiquer votre nom." };
  if (!isCountryCode(country)) return { error: "Pays invalide." };
  if (!accepted) return { error: "Vous devez accepter les conditions pour continuer." };

  const phone = parsePhone(rawPhone, country);
  if (!phone.ok) return { error: phone.error };

  const strength = validatePasswordStrength(password);
  if (strength) return { error: strength };

  if (workshopName.length < 2) return { error: "Merci d'indiquer le nom de votre atelier." };
  if (!isCurrencyCode(currency)) return { error: "Devise invalide." };

  const users = await collection("users");
  const existing = await users.findOne({ phone_e164: phone.e164 }, { projection: { id: 1 } });
  if (existing) return { error: "Un compte existe déjà avec ce numéro." };

  const plans = await collection("plans");
  const selectedPlan = await plans.findOne(
    { country_code: country, archived_at: null, ...(planCode ? { code: planCode } : {}) },
    { sort: { price_amount: 1, version: -1 }, projection: { id: 1 } },
  );
  if (!selectedPlan) return { error: "L'offre sélectionnée n'est pas disponible pour ce pays." };

  const passwordHash = await hashPassword(password);
  const countryInfo = COUNTRIES[country as CountryCode];

  const userId = await withTransaction(async (mongoSession) => {
    const uid = newId();
    const wid = newId();
    const timestamp = nowIso();
    const workshops = await collection("workshops");
    const memberships = await collection("memberships");
    const subscriptions = await collection("subscriptions");
    await users.insertOne({ id: uid, full_name: fullName, phone_e164: phone.e164, phone_verified_at: null, email: null, email_verified_at: null, password_hash: passwordHash, status: "active", platform_roles: "[]", created_at: timestamp, updated_at: timestamp, row_version: 1 }, { session: mongoSession });
    await workshops.insertOne({ id: wid, name: workshopName, owner_user_id: uid, country_code: country, city: city || null, phone_e164: phone.e164, address: null, currency, currency_locked_at: null, timezone: countryInfo.defaultTimezone, logo_media_id: null, receipt_footer: null, status: "active", suspended_reason: null, created_at: timestamp, updated_at: timestamp, row_version: 1 }, { session: mongoSession });
    await memberships.insertOne({ id: newId(), workshop_id: wid, user_id: uid, role: "owner", can_view_money: 1, status: "active", invited_at: null, created_at: timestamp, updated_at: timestamp, row_version: 1 }, { session: mongoSession });

    // The pricing-page choice is preserved through signup. Direct signups
    // receive the least expensive active offer for their country (§6.2).
    const trialEnd = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
    await subscriptions.insertOne({ id: newId(), workshop_id: wid, plan_id: selectedPlan.id, status: "trial", trial_ends_at: trialEnd, current_period_end: trialEnd, grace_ends_at: null, cancel_at_period_end: 0, cancelled_at: null, created_at: timestamp, updated_at: timestamp, row_version: 1 }, { session: mongoSession });

    await recordAudit({
      workshopId: wid,
      actorUserId: uid,
      action: "workshop.create",
      entityKind: "workshop",
      entityId: wid,
      after: { name: workshopName, country, currency },
    }, mongoSession);

    return uid;
  });

  // NOTE (§7.1 AUTH-01): phone verification is not wired up yet — no SMS
  // provider has been selected. Accounts are active on creation for the
  // pilot; add the verification step before opening registration publicly.
  await createSession(userId);

  redirect("/atelier");
}

/* ---------------------------------------------------------------
   Déconnexion
   --------------------------------------------------------------- */

export async function signOut(): Promise<void> {
  const session = await getSession();

  if (session) {
    await recordAudit({
      actorUserId: session.user.id,
      action: "auth.logout",
      entityKind: "user",
      entityId: session.user.id,
    });
  }

  await destroySession();
  redirect("/");
}
