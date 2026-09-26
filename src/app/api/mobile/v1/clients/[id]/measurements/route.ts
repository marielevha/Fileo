import { addMeasurementVersion, getClient, listMeasurements } from "@/lib/repos/clients";
import { listMeasurementAttachmentsWithUrls } from "@/lib/repos/attachments";
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
    if (!(await getClient(session.workshop.id, id))) throw new MobileApiError(404, "not_found", "Client introuvable.");
    const [measurements, attachments] = await Promise.all([
      listMeasurements(session.workshop.id, id),
      listMeasurementAttachmentsWithUrls(session.workshop.id, id),
    ]);
    const byMeasurement = new Map<string, typeof attachments>();
    for (const attachment of attachments) {
      if (!attachment.measurement_record_id) continue;
      const items = byMeasurement.get(attachment.measurement_record_id) ?? [];
      items.push(attachment);
      byMeasurement.set(attachment.measurement_record_id, items);
    }
    return ok({ items: measurements.map((measurement) => ({
      ...measurement,
      attachments: byMeasurement.get(measurement.id) ?? [],
    })) });
  });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request, "measurements.write");
    const { id } = await context.params;
    if (!(await getClient(session.workshop.id, id))) throw new MobileApiError(404, "not_found", "Client introuvable.");
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
