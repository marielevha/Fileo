import "server-only";

import { cookies } from "next/headers";
import type { Actor, PlatformRole, WorkshopRole } from "@/lib/permissions";
import { getSupabaseSession, supabaseMobileAuth } from "@/lib/supabase/mobile-auth";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ACCESS_COOKIE = "fileo_access_token";
const REFRESH_COOKIE = "fileo_refresh_token";
const WORKSHOP_COOKIE = "fileo_workshop";

export type CurrentUser = { id: string; fullName: string; phone: string; platformRoles: PlatformRole[] };
export type SessionContext = {
  user: CurrentUser; actor: Actor;
  workshop: { id: string; name: string; currency: string; countryCode: string; timezone: string; status: string; role: WorkshopRole; canViewMoney: boolean } | null;
};

const cookieOptions = (expires?: Date) => ({
  httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", expires,
});

export async function createSession(accessToken: string, refreshToken: string, expiresAt?: number): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_COOKIE, accessToken, cookieOptions(expiresAt ? new Date(expiresAt * 1000) : undefined));
  store.set(REFRESH_COOKIE, refreshToken, cookieOptions(new Date(Date.now() + 30 * 86_400_000)));
}

export async function createSessionToken(): Promise<never> {
  throw new Error("Les sessions locales ont ete remplacees par Supabase Auth.");
}

export async function destroySessionToken(token: string): Promise<void> {
  await supabaseAdmin().auth.admin.signOut(token, "local");
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;
  if (token) await supabaseAdmin().auth.admin.signOut(token, "local").catch(() => undefined);
  store.delete(ACCESS_COOKIE); store.delete(REFRESH_COOKIE); store.delete(WORKSHOP_COOKIE);
}

export async function setSessionWorkshop(workshopId: string): Promise<void> {
  (await cookies()).set(WORKSHOP_COOKIE, workshopId, cookieOptions(new Date(Date.now() + 30 * 86_400_000)));
}

export async function getSessionByToken(token: string): Promise<SessionContext | null> {
  return getSupabaseSession(token);
}

export async function getSession(): Promise<SessionContext | null> {
  const store = await cookies();
  let accessToken = store.get(ACCESS_COOKIE)?.value;
  if (accessToken) {
    const session = await getSupabaseSession(accessToken);
    if (session) return session;
  }
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;
  const { data, error } = await supabaseMobileAuth().auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) return null;
  accessToken = data.session.access_token;
  try {
    await createSession(accessToken, data.session.refresh_token, data.session.expires_at);
  } catch {
    // Server Components can read cookies but only actions and route handlers may update them.
  }
  return getSupabaseSession(accessToken);
}

export function parsePlatformRoles(raw: string | string[] | null | undefined): PlatformRole[] {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try { parsed = JSON.parse(raw); } catch { return []; }
  }
  return Array.isArray(parsed)
    ? parsed.filter((value): value is PlatformRole => value === "admin" || value === "support" || value === "content_manager")
    : [];
}
