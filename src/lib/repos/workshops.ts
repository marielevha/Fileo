import "server-only";

import { recordAudit } from "@/lib/audit";
import { sql, sqlOne, type PgExecutor } from "@/lib/supabase/postgres";

export const DEFAULT_MEASUREMENT_UNITS = ["cm", "mm", "m"] as const;

export function normaliseMeasurementUnits(input: unknown): string[] {
  const source = Array.isArray(input)
    ? input
    : String(input ?? "")
      .split(/[\n,;|]+/);
  const units: string[] = [];
  for (const item of source) {
    const unit = String(item ?? "").trim().toLowerCase();
    if (!unit || units.includes(unit)) continue;
    if (unit.length > 12 || !/^[a-z0-9%°"'/-]+$/i.test(unit)) continue;
    units.push(unit);
  }
  return units.length ? units.slice(0, 12) : [...DEFAULT_MEASUREMENT_UNITS];
}

export function parseMeasurementUnitsJson(raw: unknown): string[] {
  if (Array.isArray(raw)) return normaliseMeasurementUnits(raw);
  if (typeof raw === "string") {
    try {
      return normaliseMeasurementUnits(JSON.parse(raw));
    } catch {
      return normaliseMeasurementUnits(raw);
    }
  }
  return [...DEFAULT_MEASUREMENT_UNITS];
}

export async function getWorkshopMeasurementUnits(workshopId: string, executor?: PgExecutor): Promise<string[]> {
  const row = await sqlOne<{ measurement_units_json: string | unknown[] }>(
    "select measurement_units_json::text from public.workshops where id=$1",
    [workshopId],
    executor,
  );
  return parseMeasurementUnitsJson(row?.measurement_units_json);
}

export async function updateWorkshopMeasurementUnits(input: {
  workshopId: string;
  actorUserId: string;
  units: unknown;
}, executor?: PgExecutor): Promise<string[]> {
  const units = normaliseMeasurementUnits(input.units);
  await sql(
    "update public.workshops set measurement_units_json=$2::jsonb,row_version=row_version+1 where id=$1",
    [input.workshopId, JSON.stringify(units)],
    executor,
  );
  await recordAudit({
    workshopId: input.workshopId,
    actorUserId: input.actorUserId,
    action: "workshop.update",
    entityKind: "workshop",
    entityId: input.workshopId,
    after: { measurementUnits: units },
  }, executor);
  return units;
}
