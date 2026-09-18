import { createClient, listClients, type ClientSort } from "@/lib/repos/clients";
import { mobileHandler, MobileApiError, created, intParam, ok, optionalString, parseJsonBody, requireMobileSession, stringParam, requiredString } from "@/lib/mobile/api";
import { isCountryCode, parsePhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

type CreateClientBody = {
  displayName?: string;
  phone?: string | null;
  otherContact?: string | null;
  guardianName?: string | null;
  guardianPhone?: string | null;
  notes?: string | null;
};

export async function GET(request: Request) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request, "clients.read");
    const url = new URL(request.url);
    const page = await listClients(session.workshop.id, {
      search: stringParam(url, "q"),
      includeArchived: url.searchParams.get("includeArchived") === "true",
      page: intParam(url, "page", 1, 1, 10_000),
      pageSize: intParam(url, "pageSize", 20, 1, 100),
      sort: ["name", "phone", "orders", "lastOrder", "createdAt"].includes(stringParam(url, "sort"))
        ? stringParam(url, "sort") as ClientSort
        : "name",
      direction: stringParam(url, "direction") === "desc" ? "desc" : "asc",
    });
    return ok(page);
  });
}

export async function POST(request: Request) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request, "clients.write");
    const body = await parseJsonBody<CreateClientBody>(request);
    const displayName = requiredString(body.displayName, "Nom du client", 120);
    let phoneE164: string | null = null;
    const rawPhone = optionalString(body.phone, 40);
    if (rawPhone) {
      if (!isCountryCode(session.workshop.countryCode)) throw new MobileApiError(400, "validation_error", "Pays atelier invalide.");
      const phone = parsePhone(rawPhone, session.workshop.countryCode);
      if (!phone.ok) throw new MobileApiError(400, "validation_error", phone.error);
      phoneE164 = phone.e164;
    }

    const id = await createClient({
      workshopId: session.workshop.id,
      actorUserId: session.user.id,
      displayName,
      phoneE164,
      otherContact: optionalString(body.otherContact, 160),
      guardianName: optionalString(body.guardianName, 120),
      guardianPhone: optionalString(body.guardianPhone, 40),
      notes: optionalString(body.notes, 1000),
    });
    return created({ id });
  });
}
