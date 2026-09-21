import "server-only";

import { createClient, type AuthError } from "@supabase/supabase-js";
import type { SessionContext } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import type { PlatformRole, WorkshopRole } from "@/lib/permissions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sqlOne } from "@/lib/supabase/postgres";

function authConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Configuration Supabase Auth absente.");
  }
  return { url, anonKey };
}

export function supabaseMobileAuth() {
  const { url, anonKey } = authConfig();
  return createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

export function phoneAuthEmail(phone: string): string {
  return `p${phone.replace(/\D/g, "")}@auth.fileo.internal`;
}

export async function signInWithPasswordAndMigrate(phone: string, password: string) {
  const auth = supabaseMobileAuth();
  let first = await auth.auth.signInWithPassword({ phone, password });
  if (first.error?.code === "phone_provider_disabled") {
    first = await auth.auth.signInWithPassword({ email: phoneAuthEmail(phone), password });
  }
  if (!first.error) return first;
  if (!first.error.message.toLowerCase().includes("invalid login credentials")) return first;

  const legacy = await sqlOne<{ id: string; full_name: string; password_hash: string | null; status: string; auth_user_id: string | null }>(
    "select id,full_name,password_hash,status,auth_user_id from public.app_users where phone_e164=$1",
    [phone],
  );
  if (!legacy || legacy.status !== "active" || legacy.auth_user_id || !legacy.password_hash) return first;
  if (!(await verifyPassword(password, legacy.password_hash))) return first;

  const admin = supabaseAdmin();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: phoneAuthEmail(phone),
    password,
    email_confirm: true,
    user_metadata: { full_name: legacy.full_name, phone_e164: phone, migrated_from: "legacy" },
  });
  if (createError || !created.user) return { data: { user: null, session: null }, error: createError ?? first.error };
  const { error: linkError } = await admin.from("app_users").update({
    auth_user_id: created.user.id,
    password_hash: null,
  }).eq("id", legacy.id).is("auth_user_id", null);
  if (linkError) {
    await admin.auth.admin.deleteUser(created.user.id);
    throw linkError;
  }
  return auth.auth.signInWithPassword({ email: phoneAuthEmail(phone), password });
}

export function authErrorCode(error: AuthError): { status: number; code: string; message: string } {
  const message = error.message.toLowerCase();
  if (error.code === "phone_provider_disabled") {
    return { status: 503, code: "sms_not_configured", message: "La verification par SMS n'est pas encore configuree." };
  }
  if (error.status === 429 || message.includes("rate limit")) {
    return { status: 429, code: "rate_limited", message: "Trop de tentatives. Reessayez dans quelques instants." };
  }
  if (message.includes("invalid login credentials")) {
    return { status: 401, code: "invalid_credentials", message: "Numero de telephone ou mot de passe incorrect." };
  }
  if (message.includes("phone not confirmed")) {
    return { status: 403, code: "phone_verification_required", message: "Ce numero doit encore etre verifie." };
  }
  if (message.includes("otp") || message.includes("token")) {
    return { status: 400, code: "invalid_otp", message: "Le code est invalide ou expire." };
  }
  return { status: error.status || 400, code: "auth_error", message: "L'operation d'authentification a echoue." };
}

const platformRoles = (roles: unknown): PlatformRole[] => Array.isArray(roles)
  ? roles.filter((role): role is PlatformRole => role === "admin" || role === "support" || role === "content_manager")
  : [];

export async function getSupabaseSession(token: string): Promise<SessionContext | null> {
  if (!token) return null;
  const admin = supabaseAdmin();
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return null;

  const { data: profile, error: profileError } = await admin
    .from("app_users")
    .select("id, full_name, phone_e164, status, platform_roles")
    .eq("auth_user_id", authData.user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile || profile.status !== "active") return null;

  const roles = platformRoles(profile.platform_roles);
  const user = { id: profile.id, fullName: profile.full_name, phone: profile.phone_e164, platformRoles: roles };
  const { data: membership, error: membershipError } = await admin
    .from("memberships")
    .select("workshop_id, role, can_view_money, status, created_at")
    .eq("user_id", profile.id)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) return { user, actor: { userId: user.id, platformRoles: roles }, workshop: null };

  const { data: workshop, error: workshopError } = await admin
    .from("workshops")
    .select("id, name, currency, country_code, timezone, status")
    .eq("id", membership.workshop_id)
    .maybeSingle();
  if (workshopError) throw workshopError;
  if (!workshop) return { user, actor: { userId: user.id, platformRoles: roles }, workshop: null };

  const role: WorkshopRole = membership.role === "owner" ? "owner" : "collaborator";
  const canViewMoney = role === "owner" || membership.can_view_money === true;
  return {
    user,
    actor: {
      userId: user.id,
      platformRoles: roles,
      workshop: { id: workshop.id, role, canViewMoney, status: "active" },
    },
    workshop: {
      id: workshop.id,
      name: workshop.name,
      currency: workshop.currency,
      countryCode: workshop.country_code,
      timezone: workshop.timezone,
      status: workshop.status,
      role,
      canViewMoney,
    },
  };
}

export async function writeSupabaseAudit(input: {
  workshopId?: string | null;
  actorUserId?: string | null;
  action: string;
  entityKind: string;
  entityId?: string | null;
  after?: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin().from("audit_log").insert({
    workshop_id: input.workshopId ?? null,
    actor_user_id: input.actorUserId ?? null,
    action: input.action,
    entity_kind: input.entityKind,
    entity_id: input.entityId ?? null,
    after_json: input.after ?? null,
  });
  if (error) throw error;
}
