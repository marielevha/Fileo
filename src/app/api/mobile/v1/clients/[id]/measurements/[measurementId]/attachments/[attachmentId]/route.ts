import { deleteAttachment } from "@/lib/repos/attachments";
import { getMeasurement } from "@/lib/repos/clients";
import { mobileHandler, MobileApiError, ok, requireMobileSession } from "@/lib/mobile/api";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; measurementId: string; attachmentId: string }> },
) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request, "measurements.write");
    const { id, measurementId, attachmentId } = await context.params;
    if (!(await getMeasurement(session.workshop.id, id, measurementId))) {
      throw new MobileApiError(404, "not_found", "Mensuration introuvable.");
    }
    const deleted = await deleteAttachment({
      workshopId: session.workshop.id,
      measurementId,
      attachmentId,
    });
    if (!deleted) throw new MobileApiError(404, "not_found", "Piece jointe introuvable.");
    return ok({ id: attachmentId, deleted: true });
  });
}
