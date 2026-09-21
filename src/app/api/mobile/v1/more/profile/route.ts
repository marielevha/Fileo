import { mobileHandler, MobileApiError, ok, parseJsonBody, requireMobileSession, requiredString } from "@/lib/mobile/api";
import { recordAudit } from "@/lib/audit";
import { sql, withPgTransaction } from "@/lib/supabase/postgres";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request);
    const body = await parseJsonBody<{ fullName?: unknown }>(request);
    const fullName = requiredString(body.fullName, "Nom", 120);
    if (fullName.length < 2) throw new MobileApiError(400, "validation_error", "Le nom doit contenir au moins 2 caractères.");
    await withPgTransaction(async (client) => {
      await sql("update public.app_users set full_name=$2,row_version=row_version+1 where id=$1", [session.user.id, fullName], client);
      await recordAudit({ workshopId: session.workshop.id, actorUserId: session.user.id, action: "user.update", entityKind: "user", entityId: session.user.id, before: { fullName: session.user.fullName }, after: { fullName } }, client);
    });
    return ok({ ...session.user, fullName });
  });
}
