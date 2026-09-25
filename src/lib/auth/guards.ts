import "server-only";

import { redirect } from "next/navigation";
import { getSession, type SessionContext } from "./session";
import {
  assertAdminAbility,
  canInAdmin,
  type AdminAbility,
  type WorkshopAbility,
  assertWorkshopAbility,
} from "@/lib/permissions";
import { getAffiliateProfileForUser, type AffiliateProfile } from "@/lib/repos/affiliates";

/**
 * Page-level guards. Every protected route calls one of these first, so an
 * unauthenticated or under-privileged request never reaches a query.
 */

export async function requireUser(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect("/connexion");
  return session;
}

export type WorkshopSession = SessionContext & {
  workshop: NonNullable<SessionContext["workshop"]>;
};

export type AffiliateSession = SessionContext & {
  affiliate: AffiliateProfile;
};

/** Requires an active membership; sends the user to onboarding otherwise. */
export async function requireWorkshop(ability?: WorkshopAbility): Promise<WorkshopSession> {
  const session = await requireUser();

  if (!session.workshop) {
    const affiliate = await getAffiliateProfileForUser(session.user.id);
    if (affiliate) redirect("/affilie");
    redirect("/creer-atelier");
  }
  if (session.workshop.status === "suspended") redirect("/atelier/suspendu");

  if (ability) assertWorkshopAbility(session.actor, ability);

  return session as WorkshopSession;
}

/** Requires a Filéo staff role for the back-office (§12). */
export async function requireAdmin(ability: AdminAbility = "admin.dashboard"): Promise<SessionContext> {
  const session = await requireUser();

  // A non-staff user must not learn that /admin exists.
  if (!canInAdmin(session.actor, ability)) {
    const affiliate = await getAffiliateProfileForUser(session.user.id);
    redirect(affiliate ? "/affilie" : "/atelier");
  }

  assertAdminAbility(session.actor, ability);
  return session;
}

/** Requires an affiliate profile, but not a workshop. */
export async function requireAffiliate(): Promise<AffiliateSession> {
  const session = await requireUser();
  const affiliate = await getAffiliateProfileForUser(session.user.id);
  if (!affiliate || affiliate.status !== "active") redirect("/affiliation");
  return { ...session, affiliate };
}
