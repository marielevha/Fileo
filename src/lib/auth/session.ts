import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { collection, newId, nowIso, toBool } from "@/lib/db";
import type { Actor, PlatformRole, WorkshopRole } from "@/lib/permissions";

const COOKIE_NAME = "fileo_session";
const SESSION_DAYS = 30;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSessionToken(
  userId: string,
  options: { workshopId?: string | null; userAgent?: string | null } = {},
): Promise<{ token: string; expiresAt: string }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  const sessions = await collection("sessions");
  const timestamp = nowIso();
  await sessions.insertOne({
    id: newId(), user_id: userId, token_hash: hashToken(token), workshop_id: options.workshopId ?? null,
    user_agent: options.userAgent ?? null, created_at: timestamp, last_seen_at: timestamp,
    expires_at: expiresAt.toISOString(), revoked_at: null,
  });
  return { token, expiresAt: expiresAt.toISOString() };
}

export async function createSession(userId: string, options: { workshopId?: string | null; userAgent?: string | null } = {}): Promise<void> {
  const { token, expiresAt } = await createSessionToken(userId, options);
  const store = await cookies();
  store.set(COOKIE_NAME, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: new Date(expiresAt) });
}

export async function destroySessionToken(token: string): Promise<void> {
  const sessions = await collection("sessions");
  await sessions.updateOne({ token_hash: hashToken(token) }, { $set: { revoked_at: nowIso() } });
}

export async function destroySession(): Promise<void> {
  const store = await cookies(); const token = store.get(COOKIE_NAME)?.value;
  if (token) {
    await destroySessionToken(token);
  }
  store.delete(COOKIE_NAME);
}

export async function setSessionWorkshop(workshopId: string): Promise<void> {
  const store = await cookies(); const token = store.get(COOKIE_NAME)?.value;
  if (!token) return;
  const sessions = await collection("sessions");
  await sessions.updateOne({ token_hash: hashToken(token) }, { $set: { workshop_id: workshopId } });
}

export type CurrentUser = { id: string; fullName: string; phone: string; platformRoles: PlatformRole[] };
export type SessionContext = {
  user: CurrentUser; actor: Actor;
  workshop: { id: string; name: string; currency: string; countryCode: string; timezone: string; status: string; role: WorkshopRole; canViewMoney: boolean } | null;
};

export async function getSessionByToken(token: string): Promise<SessionContext | null> {
  if (!token) return null;
  const sessions = await collection("sessions"); const users = await collection("users");
  const session = await sessions.findOne({ token_hash: hashToken(token), revoked_at: null, expires_at: { $gt: nowIso() } });
  if (!session) return null;
  const userRow = await users.findOne({ id: session.user_id, status: "active" });
  if (!userRow) return null;
  await sessions.updateOne({ id: session.id }, { $set: { last_seen_at: nowIso() } });
  const platformRoles = parsePlatformRoles(String(userRow.platform_roles ?? "[]"));
  const user: CurrentUser = { id: String(userRow.id), fullName: String(userRow.full_name), phone: String(userRow.phone_e164), platformRoles };

  const memberships = await collection("memberships");
  const membershipFilter: Record<string, unknown> = { user_id: user.id, status: "active" };
  if (session.workshop_id) membershipFilter.workshop_id = session.workshop_id;
  const membershipRows = await memberships.find(membershipFilter).toArray();
  membershipRows.sort((a, b) => {
    const role = (a.role === "owner" ? 0 : 1) - (b.role === "owner" ? 0 : 1);
    return role || String(a.created_at).localeCompare(String(b.created_at));
  });
  const membership = membershipRows[0];
  if (!membership) return { user, actor: { userId: user.id, platformRoles }, workshop: null };
  const workshops = await collection("workshops");
  const workshop = await workshops.findOne({ id: membership.workshop_id });
  if (!workshop) return { user, actor: { userId: user.id, platformRoles }, workshop: null };
  const role: WorkshopRole = membership.role === "owner" ? "owner" : "collaborator";
  const canViewMoney = role === "owner" || toBool(membership.can_view_money);
  return {
    user,
    actor: { userId: user.id, platformRoles, workshop: { id: String(workshop.id), role, canViewMoney, status: membership.status as "active" | "disabled" | "invited" } },
    workshop: { id: String(workshop.id), name: String(workshop.name), currency: String(workshop.currency), countryCode: String(workshop.country_code), timezone: String(workshop.timezone), status: String(workshop.status), role, canViewMoney },
  };
}

export async function getSession(): Promise<SessionContext | null> {
  const store = await cookies(); const token = store.get(COOKIE_NAME)?.value;
  return token ? getSessionByToken(token) : null;
}

export function parsePlatformRoles(raw: string): PlatformRole[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is PlatformRole => value === "admin" || value === "support" || value === "content_manager");
  } catch { return []; }
}
