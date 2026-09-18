import { addMeasurementVersion, listMeasurements } from "@/lib/repos/clients";
import { mobileHandler, MobileApiError, created, ok, optionalDate, optionalString, parseJsonBody, requireMobileSession, requiredString } from "@/lib/mobile/api";

export const dynamic = "force-dynamic";

type MeasurementBody = {
  category?: string;
  values?: Record<string, number | null>;
  notes?: string | null;
  takenAt?: string | null;
};

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request, "measurements.read");
    const { id } = await context.params;
    return ok({ items: await listMeasurements(session.workshop.id, id) });
  });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request, "measurements.write");
    const { id } = await context.params;
    const body = await parseJsonBody<MeasurementBody>(request);
    const values = body.values && typeof body.values === "object" ? body.values : null;
    if (!values || Object.keys(values).length === 0) {
      throw new MobileApiError(400, "validation_error", "Au moins une mesure est obligatoire.");
    }
    const measurementId = await addMeasurementVersion({
      workshopId: session.workshop.id,
      clientId: id,
      actorUserId: session.user.id,
      category: requiredString(body.category, "Categorie", 80),
      values,
      notes: optionalString(body.notes, 1000),
      takenAt: optionalDate(body.takenAt, "Date de prise") ?? undefined,
    });
    return created({ id: measurementId });
  });
}
