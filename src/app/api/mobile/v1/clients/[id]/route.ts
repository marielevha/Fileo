import { getClient, softDeleteClient, updateClient } from "@/lib/repos/clients";
import { mobileHandler, MobileApiError, ok, optionalString, parseJsonBody, requireMobileSession, requiredString } from "@/lib/mobile/api";
import { isCountryCode, parsePhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

type UpdateClientBody = {
  displayName?: string;
  phone?: string | null;
  otherContact?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  notes?: string | null;
};

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request, "clients.read");
    const { id } = await context.params;
    const client = await getClient(session.workshop.id, id);
    if (!client) throw new MobileApiError(404, "not_found", "Client introuvable.");
    return ok(client);
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request, "clients.write");
    const { id } = await context.params;
    const body = await parseJsonBody<UpdateClientBody>(request);
    const displayName = requiredString(body.displayName, "Nom du client", 120);
    let phoneE164: string | null = null;
    const rawPhone = optionalString(body.phone, 40);
    if (rawPhone) {
      if (!isCountryCode(session.workshop.countryCode)) throw new MobileApiError(400, "validation_error", "Pays atelier invalide.");
      const phone = parsePhone(rawPhone, session.workshop.countryCode);
      if (!phone.ok) throw new MobileApiError(400, "validation_error", phone.error);
      phoneE164 = phone.e164;
    }

    const updated = await updateClient({
      workshopId: session.workshop.id,
      actorUserId: session.user.id,
      clientId: id,
      displayName,
      phoneE164,
      otherContact: optionalString(body.otherContact, 160),
      guardianName: optionalString(body.guardianName, 120),
      guardianPhone: optionalString(body.guardianPhone, 40),
      notes: optionalString(body.notes, 1000),
    });
    if (!updated) throw new MobileApiError(404, "not_found", "Client introuvable.");
    return ok({ id });
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request, "clients.write");
    const { id } = await context.params;
    const deleted = await softDeleteClient({
      workshopId: session.workshop.id,
      actorUserId: session.user.id,
      clientId: id,
    });
    if (!deleted) throw new MobileApiError(404, "not_found", "Client introuvable.");
    return ok({ id, deleted: true });
  });
}
