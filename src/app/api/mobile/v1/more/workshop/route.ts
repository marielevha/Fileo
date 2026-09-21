import { recordAudit } from "@/lib/audit";
import { mobileHandler, MobileApiError, ok, optionalString, parseJsonBody, requireMobileSession, requiredString } from "@/lib/mobile/api";
import { sql, sqlOne, withPgTransaction } from "@/lib/supabase/postgres";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request);
    const workshop = await sqlOne<{ name: string; city: string | null; country_code: string; currency: string; timezone: string }>(
      "select name,city,country_code,currency,timezone from public.workshops where id=$1", [session.workshop.id],
    );
    if (!workshop) throw new MobileApiError(404, "not_found", "Atelier introuvable.");
    return ok(workshop);
  });
}

export async function PATCH(request: Request) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request);
    if (session.workshop.role !== "owner") throw new MobileApiError(403, "forbidden", "Seul un responsable peut modifier l'atelier.");
    const body = await parseJsonBody<{ name?: unknown; city?: unknown }>(request);
    const name = requiredString(body.name, "Nom de l'atelier", 120);
    const city = optionalString(body.city, 120);
    if (name.length < 2) throw new MobileApiError(400, "validation_error", "Le nom doit contenir au moins 2 caractères.");
    await withPgTransaction(async (client) => {
      await sql("update public.workshops set name=$2,city=$3,row_version=row_version+1 where id=$1", [session.workshop.id, name, city], client);
      await recordAudit({ workshopId: session.workshop.id, actorUserId: session.user.id, action: "workshop.update", entityKind: "workshop", entityId: session.workshop.id, after: { name, city } }, client);
    });
    return ok({ name, city });
  });
}
