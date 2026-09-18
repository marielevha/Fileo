import "server-only";

import { NextResponse } from "next/server";
import { getSessionByToken, type SessionContext } from "@/lib/auth/session";
import { assertWorkshopAbility, PermissionError, type WorkshopAbility } from "@/lib/permissions";

export class MobileApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "MobileApiError";
  }
}

export type MobileWorkshopSession = SessionContext & {
  workshop: NonNullable<SessionContext["workshop"]>;
};

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ ok: true, data }, init);
}

export function created<T>(data: T): NextResponse {
  return ok(data, { status: 201 });
}

export function fail(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

export async function mobileHandler(work: () => Promise<Response>): Promise<Response> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof MobileApiError) {
      return fail(error.status, error.code, error.message);
    }
    console.error("[mobile-api]", error);
    return fail(500, "internal_error", "Erreur serveur.");
  }
}

export async function parseJsonBody<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    return await request.json() as T;
  } catch {
    throw new MobileApiError(400, "invalid_json", "Corps JSON invalide.");
  }
}

export async function requireMobileSession(
  request: Request,
  ability?: WorkshopAbility,
): Promise<MobileWorkshopSession> {
  const token = bearerToken(request);
  if (!token) throw new MobileApiError(401, "missing_token", "Token Bearer manquant.");

  const session = await getSessionByToken(token);
  if (!session) throw new MobileApiError(401, "invalid_token", "Session invalide ou expiree.");
  if (!session.workshop) throw new MobileApiError(403, "workshop_required", "Aucun atelier actif n'est associe a cette session.");
  if (session.workshop.status === "suspended") {
    throw new MobileApiError(403, "workshop_suspended", "Cet atelier est suspendu.");
  }
  if (ability) {
    try {
      assertWorkshopAbility(session.actor, ability);
    } catch (error) {
      if (error instanceof PermissionError) {
        throw new MobileApiError(403, "forbidden", "Action non autorisee.");
      }
      throw error;
    }
  }
  return session as MobileWorkshopSession;
}

export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}

export function stringParam(url: URL, key: string, fallback = ""): string {
  return url.searchParams.get(key)?.trim() ?? fallback;
}

export function intParam(url: URL, key: string, fallback: number, min = 1, max = 100): number {
  const value = Number.parseInt(url.searchParams.get(key) ?? "", 10);
  if (!Number.isSafeInteger(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

export function requiredString(value: unknown, label: string, maxLength = 500): string {
  const text = String(value ?? "").trim();
  if (!text) throw new MobileApiError(400, "validation_error", `${label} est obligatoire.`);
  return text.slice(0, maxLength);
}

export function optionalString(value: unknown, maxLength = 500): string | null {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, maxLength) : null;
}

export function optionalDate(value: unknown, label: string): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new MobileApiError(400, "validation_error", `${label} est invalide.`);
  }
  const date = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw new MobileApiError(400, "validation_error", `${label} est invalide.`);
  }
  return text;
}

export function integerAmount(value: unknown, label: string): number {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new MobileApiError(400, "validation_error", `${label} est invalide.`);
  }
  return amount;
}

export function sessionPayload(session: MobileWorkshopSession) {
  return {
    user: session.user,
    workshop: session.workshop,
    capabilities: {
      canViewMoney: session.workshop.canViewMoney,
      role: session.workshop.role,
    },
  };
}
