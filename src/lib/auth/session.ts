import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { execute, newId, nowIso, queryOne, toBool } from "@/lib/db";
import type { Actor, PlatformRole, WorkshopRole } from "@/lib/permissions";

/**
 * Session handling (§7.1 AUTH-02 / AUTH-04).
 *
 * The cookie holds a random token; only its SHA-256 lives in the database, so
 * a database leak does not hand out live sessions. Sessions are listable and
 * revocable per device.
 */

const COOKIE_NAME = "fileo_session";
const SESSION_DAYS = 30;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(
  userId: string,
  options: { workshopId?: string | null; userAgent?: string | null } = {},
): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  execute(
    `INSERT INTO sessions
       (id, user_id, token_hash, workshop_id, user_agent, created_at, last_seen_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newId(),
      userId,
      hashToken(token),
      options.workshopId ?? null,
      options.userAgent ?? null,
      nowIso(),
      nowIso(),
      expiresAt.toISOString(),
    ],
  );

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;

  if (token) {
    execute(`UPDATE sessions SET revoked_at = ? WHERE token_hash = ?`, [
      nowIso(),
      hashToken(token),
    ]);
  }

  store.delete(COOKIE_NAME);
}

/** Switches which workshop the current session is acting in. */
export async function setSessionWorkshop(workshopId: string): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return;

  execute(`UPDATE sessions SET workshop_id = ? WHERE token_hash = ?`, [
    workshopId,
    hashToken(token),
  ]);
}

type SessionRow = {
  session_id: string;
  user_id: string;
  full_name: string;
  phone_e164: string;
  user_status: string;
  platform_roles: string;
  workshop_id: string | null;
};

export type CurrentUser = {
  id: string;
  fullName: string;
  phone: string;
  platformRoles: PlatformRole[];
};

export type SessionContext = {
  user: CurrentUser;
  actor: Actor;
  workshop: {
    id: string;
    name: string;
    currency: string;
    countryCode: string;
    timezone: string;
    status: string;
    role: WorkshopRole;
    canViewMoney: boolean;
  } | null;
};

/**
 * Resolves the caller from the session cookie. Returns null rather than
 * throwing so callers can decide between a redirect and a 401.
 */
export async function getSession(): Promise<SessionContext | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const row = queryOne<SessionRow>(
    `SELECT s.id            AS session_id,
            u.id            AS user_id,
            u.full_name     AS full_name,
            u.phone_e164    AS phone_e164,
            u.status        AS user_status,
            u.platform_roles AS platform_roles,
            s.workshop_id   AS workshop_id
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ?
        AND s.revoked_at IS NULL
        AND s.expires_at > ?`,
    [hashToken(token), nowIso()],
  );

  if (!row || row.user_status !== "active") return null;

  execute(`UPDATE sessions SET last_seen_at = ? WHERE id = ?`, [nowIso(), row.session_id]);

  const platformRoles = parsePlatformRoles(row.platform_roles);

  const user: CurrentUser = {
    id: row.user_id,
    fullName: row.full_name,
    phone: row.phone_e164,
    platformRoles,
  };

  // Fall back to the user's only membership when the session has no workshop
  // pinned yet (fresh login, or one-workshop accounts).
  const membership = queryOne<{
    workshop_id: string;
    name: string;
    currency: string;
    country_code: string;
    timezone: string;
    workshop_status: string;
    role: string;
    can_view_money: number;
    membership_status: string;
  }>(
    `SELECT w.id AS workshop_id, w.name, w.currency, w.country_code, w.timezone,
            w.status AS workshop_status,
            m.role, m.can_view_money, m.status AS membership_status
       FROM memberships m
       JOIN workshops w ON w.id = m.workshop_id
      WHERE m.user_id = ?
        AND m.status = 'active'
        AND (? IS NULL OR m.workshop_id = ?)
      ORDER BY (m.role = 'owner') DESC, w.created_at ASC
      LIMIT 1`,
    [row.user_id, row.workshop_id, row.workshop_id],
  );

  if (!membership) {
    return { user, actor: { userId: user.id, platformRoles }, workshop: null };
  }

  const role: WorkshopRole = membership.role === "owner" ? "owner" : "collaborator";
  const canViewMoney = role === "owner" || toBool(membership.can_view_money);

  return {
    user,
    actor: {
      userId: user.id,
      platformRoles,
      workshop: {
        id: membership.workshop_id,
        role,
        canViewMoney,
        status: membership.membership_status as "active" | "disabled" | "invited",
      },
    },
    workshop: {
      id: membership.workshop_id,
      name: membership.name,
      currency: membership.currency,
      countryCode: membership.country_code,
      timezone: membership.timezone,
      status: membership.workshop_status,
      role,
      canViewMoney,
    },
  };
}

export function parsePlatformRoles(raw: string): PlatformRole[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (value): value is PlatformRole =>
        value === "admin" || value === "support" || value === "content_manager",
    );
  } catch {
    return [];
  }
}
