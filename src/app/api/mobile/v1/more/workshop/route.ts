import { recordAudit } from "@/lib/audit";
import { mobileHandler, MobileApiError, ok, optionalString, parseJsonBody, requireMobileSession, requiredString } from "@/lib/mobile/api";
import { normaliseMeasurementUnits } from "@/lib/repos/workshops";
import { sql, sqlOne, withPgTransaction } from "@/lib/supabase/postgres";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request);
    const workshop = await sqlOne<{
      name: string;
      city: string | null;
      country_code: string;
      currency: string;
      timezone: string;
      measurement_units_json: string;
    }>(
      "select name,city,country_code,currency,timezone,measurement_units_json::text from public.workshops where id=$1",
      [session.workshop.id],
    );
    if (!workshop) throw new MobileApiError(404, "not_found", "Atelier introuvable.");
    return ok(workshop);
  });
}

export async function PATCH(request: Request) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request);
    if (session.workshop.role !== "owner") throw new MobileApiError(403, "forbidden", "Seul un responsable peut modifier l'atelier.");

    const body = await parseJsonBody<{ name?: unknown; city?: unknown; measurementUnits?: unknown }>(request);
    const name = requiredString(body.name, "Nom de l'atelier", 120);
    const city = optionalString(body.city, 120);
    const measurementUnits = normaliseMeasurementUnits(body.measurementUnits);
    if (name.length < 2) throw new MobileApiError(400, "validation_error", "Le nom doit contenir au moins 2 caracteres.");

    await withPgTransaction(async (client) => {
      await sql(
        "update public.workshops set name=$2,city=$3,measurement_units_json=$4::jsonb,row_version=row_version+1 where id=$1",
        [session.workshop.id, name, city, JSON.stringify(measurementUnits)],
        client,
      );
      await recordAudit({
        workshopId: session.workshop.id,
        actorUserId: session.user.id,
        action: "workshop.update",
        entityKind: "workshop",
        entityId: session.workshop.id,
        after: { name, city, measurementUnits },
      }, client);
    });
    return ok({ name, city, measurementUnits });
  });
}
