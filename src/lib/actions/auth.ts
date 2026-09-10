"use server";

import { redirect } from "next/navigation";
import { execute, newId, nowIso, queryOne, transaction } from "@/lib/db";
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

  const user = queryOne<{ id: string; password_hash: string; status: string; platform_roles: string }>(
    `SELECT id, password_hash, status, platform_roles FROM users WHERE phone_e164 = ?`,
    [phone.e164],
  );

  // Same message whether the number is unknown or the password is wrong:
  // an attacker must not be able to enumerate accounts.
  const generic = { error: "Numéro de téléphone ou mot de passe incorrect." };

  if (!user) return generic;
  if (!(await verifyPassword(password, user.password_hash))) return generic;
  if (user.status !== "active") return { error: "Ce compte est désactivé." };

  await createSession(user.id);
  recordAudit({ actorUserId: user.id, action: "auth.login", entityKind: "user", entityId: user.id });

  const platformRoles = parsePlatformRoles(user.platform_roles);
  const destination = canInAdmin(
    { userId: user.id, platformRoles },
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

  const existing = queryOne<{ id: string }>(`SELECT id FROM users WHERE phone_e164 = ?`, [
    phone.e164,
  ]);
  if (existing) return { error: "Un compte existe déjà avec ce numéro." };

  const selectedPlan = queryOne<{ id: string }>(
    `SELECT id FROM plans
      WHERE country_code = ? AND archived_at IS NULL
        AND (? = '' OR code = ?)
      ORDER BY price_amount ASC, version DESC LIMIT 1`,
    [country, planCode, planCode],
  );
  if (!selectedPlan) return { error: "L'offre sélectionnée n'est pas disponible pour ce pays." };

  const passwordHash = await hashPassword(password);
  const countryInfo = COUNTRIES[country as CountryCode];

  const userId = transaction(() => {
    const uid = newId();
    const wid = newId();

    execute(
      `INSERT INTO users
         (id, full_name, phone_e164, password_hash, status, platform_roles, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'active', '[]', ?, ?)`,
      [uid, fullName, phone.e164, passwordHash, nowIso(), nowIso()],
    );

    execute(
      `INSERT INTO workshops
         (id, name, owner_user_id, country_code, city, phone_e164, currency,
          timezone, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      [
        wid,
        workshopName,
        uid,
        country,
        city || null,
        phone.e164,
        currency,
        countryInfo.defaultTimezone,
        nowIso(),
        nowIso(),
      ],
    );

    execute(
      `INSERT INTO memberships
         (id, workshop_id, user_id, role, can_view_money, status, created_at, updated_at)
       VALUES (?, ?, ?, 'owner', 1, 'active', ?, ?)`,
      [newId(), wid, uid, nowIso(), nowIso()],
    );

    // The pricing-page choice is preserved through signup. Direct signups
    // receive the least expensive active offer for their country (§6.2).
    const trialEnd = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
    execute(
      `INSERT INTO subscriptions
         (id, workshop_id, plan_id, status, trial_ends_at, current_period_end, created_at, updated_at)
       VALUES (?, ?, ?, 'trial', ?, ?, ?, ?)`,
      [newId(), wid, selectedPlan.id, trialEnd, trialEnd, nowIso(), nowIso()],
    );

    recordAudit({
      workshopId: wid,
      actorUserId: uid,
      action: "workshop.create",
      entityKind: "workshop",
      entityId: wid,
      after: { name: workshopName, country, currency },
    });

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
    recordAudit({
      actorUserId: session.user.id,
      action: "auth.logout",
      entityKind: "user",
      entityId: session.user.id,
    });
  }

  await destroySession();
  redirect("/");
}
