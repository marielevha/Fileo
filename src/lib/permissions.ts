/**
 * Permission model — cahier des charges §4.2.
 *
 * "Les contrôles sont effectués par le serveur… Masquer un bouton ne suffit
 * pas." Every guard here is meant to run on the server; the UI may consult the
 * same helpers to decide what to render, but that is a convenience, never the
 * enforcement point.
 */

export type WorkshopRole = "owner" | "collaborator";

/** Filéo staff roles, independent of any workshop (§4.1). */
export type PlatformRole = "admin" | "support" | "content_manager";

export const PLATFORM_ROLES: PlatformRole[] = ["admin", "support", "content_manager"];

export type Actor = {
  userId: string;
  platformRoles: PlatformRole[];
  /** Absent when the actor is Filéo staff acting outside any workshop. */
  workshop?: {
    id: string;
    role: WorkshopRole;
    canViewMoney: boolean;
    status: "active" | "disabled" | "invited";
  };
};

export type WorkshopAbility =
  | "clients.read"
  | "clients.write"
  | "measurements.read"
  | "measurements.write"
  | "orders.read"
  | "orders.write"
  | "orders.cancel"
  | "money.read"
  | "money.write"
  | "money.correct"
  | "expenses.read"
  | "expenses.write"
  | "exports.run"
  | "team.manage"
  | "subscription.manage"
  | "workshop.delete";

/**
 * Direct transcription of the permission matrix in §4.2. Kept as one readable
 * switch rather than a config object so a reviewer can check it line by line
 * against the spec.
 */
export function canInWorkshop(actor: Actor, ability: WorkshopAbility): boolean {
  const membership = actor.workshop;
  if (!membership || membership.status !== "active") return false;

  const isOwner = membership.role === "owner";
  const hasMoney = isOwner || membership.canViewMoney;

  switch (ability) {
    // Everyone active in the workshop handles the craft itself.
    case "clients.read":
    case "clients.write":
    case "measurements.read":
    case "measurements.write":
    case "orders.read":
    case "orders.write":
      return true;

    // Financial visibility is granted explicitly (§4.1).
    case "money.read":
    case "money.write":
    case "expenses.read":
    case "expenses.write":
      return hasMoney;

    // Owner-only: destructive or corrective financial acts (§4.2).
    case "orders.cancel":
    case "money.correct":
    case "exports.run":
    case "team.manage":
    case "subscription.manage":
    case "workshop.delete":
      return isOwner;
  }
}

export function hasPlatformRole(actor: Actor, role: PlatformRole): boolean {
  return actor.platformRoles.includes(role);
}

export function isPlatformStaff(actor: Actor): boolean {
  return actor.platformRoles.length > 0;
}

/** Back-office abilities (§12). Content publishing is its own role (§4.2). */
export type AdminAbility =
  | "admin.dashboard"
  | "admin.workshops"
  | "admin.subscriptions"
  | "admin.payments.validate"
  | "admin.contents"
  | "admin.tickets"
  | "admin.audit";

export function canInAdmin(actor: Actor, ability: AdminAbility): boolean {
  const isAdmin = hasPlatformRole(actor, "admin");
  const isSupport = hasPlatformRole(actor, "support");
  const isEditor = hasPlatformRole(actor, "content_manager");

  switch (ability) {
    case "admin.dashboard":
      return isAdmin || isSupport || isEditor;
    case "admin.contents":
      return isAdmin || isEditor;
    case "admin.tickets":
      return isAdmin || isSupport;
    case "admin.workshops":
      return isAdmin || isSupport;
    case "admin.subscriptions":
    case "admin.payments.validate":
    case "admin.audit":
      return isAdmin;
  }
}

/**
 * Strips money fields from a payload for actors without `money.read`.
 *
 * §4.2: "Les champs financiers ne sont pas transmis aux utilisateurs qui n'ont
 * pas le droit de les consulter" — omitting them from the response, not just
 * from the screen (REC-12).
 */
export function redactMoney<T extends Record<string, unknown>>(
  value: T,
  keys: ReadonlyArray<keyof T>,
  allowed: boolean,
): T {
  if (allowed) return value;

  const copy = { ...value };
  for (const key of keys) delete copy[key];
  return copy;
}

export class PermissionError extends Error {
  constructor(message = "Action non autorisée.") {
    super(message);
    this.name = "PermissionError";
  }
}

export function assertWorkshopAbility(actor: Actor, ability: WorkshopAbility): void {
  if (!canInWorkshop(actor, ability)) {
    throw new PermissionError();
  }
}

export function assertAdminAbility(actor: Actor, ability: AdminAbility): void {
  if (!canInAdmin(actor, ability)) {
    throw new PermissionError();
  }
}
