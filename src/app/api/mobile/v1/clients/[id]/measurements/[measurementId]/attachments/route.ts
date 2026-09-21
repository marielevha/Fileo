import {
  AttachmentUploadError,
  listMeasurementAttachmentsWithUrls,
  uploadMeasurementAttachments,
} from "@/lib/repos/attachments";
import { getMeasurement } from "@/lib/repos/clients";
import { attachmentFilesFromRequest, created, mobileHandler, MobileApiError, ok, requireMobileSession } from "@/lib/mobile/api";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; measurementId: string }> };

export async function GET(request: Request, context: RouteContext) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request, "measurements.read");
    const { id, measurementId } = await context.params;
    if (!(await getMeasurement(session.workshop.id, id, measurementId))) {
      throw new MobileApiError(404, "not_found", "Mensuration introuvable.");
    }
    const all = await listMeasurementAttachmentsWithUrls(session.workshop.id, id);
    return ok({ items: all.filter((item) => item.measurement_record_id === measurementId) });
  });
}

export async function POST(request: Request, context: RouteContext) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request, "measurements.write");
    const { id, measurementId } = await context.params;
    if (!(await getMeasurement(session.workshop.id, id, measurementId))) {
      throw new MobileApiError(404, "not_found", "Mensuration introuvable.");
    }
    const files = await attachmentFilesFromRequest(request);
    try {
      return created({ items: await uploadMeasurementAttachments({
        workshopId: session.workshop.id,
        clientId: id,
        measurementId,
        actorUserId: session.user.id,
        files,
      }) });
    } catch (error) {
      if (error instanceof AttachmentUploadError) {
        throw new MobileApiError(400, "attachment_error", error.message);
      }
      throw error;
    }
  });
}
