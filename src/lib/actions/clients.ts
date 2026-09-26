"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireWorkshop } from "@/lib/auth/guards";
import {
  archiveClient,
  createClient,
  getClient,
  softDeleteClient,
  updateClient,
} from "@/lib/repos/clients";
import { isCountryCode, parsePhone } from "@/lib/phone";
import { getLocale } from "@/lib/i18n/request";
import { localePath } from "@/lib/i18n/config";

export type ClientFormState = { error?: string };

function optional(value: FormDataEntryValue | null, maxLength = 1000) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, maxLength) : null;
}

async function parseClientForm(formData: FormData) {
  const { workshop } = await requireWorkshop("clients.write");
  const displayName = String(formData.get("displayName") ?? "").trim();
  if (displayName.length < 2 || displayName.length > 120) {
    return { error: "Le nom doit contenir entre 2 et 120 caractères." } as const;
  }
  if (!isCountryCode(workshop.countryCode)) {
    return { error: "Le pays de l'atelier est invalide." } as const;
  }

  const rawPhone = optional(formData.get("phone"), 40);
  const phone = rawPhone ? parsePhone(rawPhone, workshop.countryCode) : null;
  if (phone && !phone.ok) return { error: phone.error } as const;

  const rawGuardianPhone = optional(formData.get("guardianPhone"), 40);
  const guardianPhone = rawGuardianPhone
    ? parsePhone(rawGuardianPhone, workshop.countryCode)
    : null;
  if (guardianPhone && !guardianPhone.ok) return { error: guardianPhone.error } as const;

  return {
    workshop,
    values: {
      displayName,
      phoneE164: phone?.ok ? phone.e164 : null,
      otherContact: optional(formData.get("otherContact"), 160),
      guardianName: optional(formData.get("guardianName"), 120),
      guardianPhone: guardianPhone?.ok ? guardianPhone.e164 : null,
      notes: optional(formData.get("notes"), 2000),
    },
  } as const;
}

export async function createClientAction(
  _previous: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const parsed = await parseClientForm(formData);
  if ("error" in parsed) return { error: parsed.error };
  const locale = await getLocale();
  const session = await requireWorkshop("clients.write");
  const id = await createClient({
    workshopId: parsed.workshop.id,
    actorUserId: session.user.id,
    ...parsed.values,
  });
  revalidatePath(localePath(locale, "/atelier/clients"));
  redirect(localePath(locale, `/atelier/clients/${id}`));
}

export async function updateClientAction(
  clientId: string,
  _previous: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const parsed = await parseClientForm(formData);
  if ("error" in parsed) return { error: parsed.error };
  const locale = await getLocale();
  const session = await requireWorkshop("clients.write");
  const updated = await updateClient({
    clientId,
    workshopId: parsed.workshop.id,
    actorUserId: session.user.id,
    ...parsed.values,
  });
  if (!updated) return { error: "Ce client n'existe plus ou a été supprimé." };
  revalidatePath(localePath(locale, "/atelier/clients"));
  redirect(localePath(locale, `/atelier/clients/${clientId}`));
}

export async function toggleClientArchiveAction(clientId: string): Promise<void> {
  const session = await requireWorkshop("clients.write");
  const client = await getClient(session.workshop.id, clientId);
  if (!client) return;
  await archiveClient({
    workshopId: session.workshop.id,
    clientId,
    actorUserId: session.user.id,
    archived: !client.archived_at,
  });
  const locale = await getLocale();
  revalidatePath(localePath(locale, "/atelier/clients"));
  revalidatePath(localePath(locale, `/atelier/clients/${clientId}`));
}

export async function deleteClientAction(clientId: string): Promise<void> {
  const session = await requireWorkshop("clients.write");
  await softDeleteClient({
    workshopId: session.workshop.id,
    clientId,
    actorUserId: session.user.id,
  });
  const locale = await getLocale();
  revalidatePath(localePath(locale, "/atelier/clients"));
  redirect(localePath(locale, "/atelier/clients"));
}
