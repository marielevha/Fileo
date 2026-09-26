import "server-only";

import { recordAudit } from "@/lib/audit";
import { sqlOne, withPgTransaction } from "@/lib/supabase/postgres";

export type SupportContact = {
  email: string;
  app_version: string;
  company_name: string;
  row_version: number;
  updated_at: string;
};

export async function getSupportContact(): Promise<SupportContact> {
  const contact = await sqlOne<SupportContact>(
    "select email, app_version, company_name, row_version, updated_at from public.platform_support_contact where id = true",
  );
  if (!contact) throw new Error("Configuration du support introuvable.");
  return contact;
}

export async function updateSupportContact(input: {
  email: string;
  appVersion: string;
  companyName: string;
  rowVersion: number;
  actorUserId: string;
}): Promise<void> {
  await withPgTransaction(async (client) => {
    const before = await sqlOne<SupportContact>(
      "select email, app_version, company_name, row_version, updated_at from public.platform_support_contact where id = true",
      [], client,
    );
    if (!before) throw new Error("Configuration du support introuvable.");
    if (before.row_version !== input.rowVersion) {
      throw new Error("Les parametres ont ete modifies. Rechargez la page.");
    }

    const updated = await sqlOne<{ email: string; app_version: string; company_name: string }>(`update public.platform_support_contact
      set email = $1, app_version = $2, company_name = $3, updated_at = now(), updated_by = $4, row_version = row_version + 1
      where id = true and row_version = $5
      returning email, app_version, company_name`,
      [input.email, input.appVersion, input.companyName, input.actorUserId, input.rowVersion], client);
    if (!updated) throw new Error("Les parametres ont ete modifies. Rechargez la page.");

    await recordAudit({
      actorUserId: input.actorUserId,
      action: "platform_support.update",
      entityKind: "platform_support_contact",
      before: {
        email: before.email,
        appVersion: before.app_version,
        companyName: before.company_name,
        rowVersion: before.row_version,
      },
      after: {
        email: updated.email,
        appVersion: updated.app_version,
        companyName: updated.company_name,
        rowVersion: before.row_version + 1,
      },
    }, client);
  });
}
