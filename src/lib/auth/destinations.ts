import "server-only";

import { canInAdmin, type PlatformRole } from "@/lib/permissions";
import { getAffiliateProfileForUser } from "@/lib/repos/affiliates";
import { sqlOne } from "@/lib/supabase/postgres";

export async function getPostLoginDestination(input: {
  userId: string;
  platformRoles: PlatformRole[];
  hasWorkshop?: boolean;
}) {
  if (canInAdmin({ userId: input.userId, platformRoles: input.platformRoles }, "admin.dashboard")) {
    return "/admin";
  }

  if (input.hasWorkshop === true) return "/atelier";
  if (input.hasWorkshop === undefined) {
    const membership = await sqlOne<{ workshop_id: string }>(
      "select workshop_id from public.memberships where user_id=$1 and status='active' limit 1",
      [input.userId],
    );
    if (membership) return "/atelier";
  }

  const affiliate = await getAffiliateProfileForUser(input.userId);
  if (affiliate) return "/affilie";

  return "/atelier";
}
