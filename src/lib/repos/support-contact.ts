import "server-only";

import { recordAudit } from "@/lib/audit";
import { sqlOne, withPgTransaction } from "@/lib/supabase/postgres";

export type SupportContact = {
  email: string;
  row_version: number;
  updated_at: string;
};

export async function getSupportContact(): Promise<SupportContact> {
  const contact = await sqlOne<SupportContact>(
    "select email, row_version, updated_at from public.platform_support_contact where id = true",
  );
  if (!contact) throw new Error("Configuration du support introuvable.");
  return contact;
}

export async function updateSupportContact(input: {
  email: string;
  rowVersion: number;
  actorUserId: string;
}): Promise<void> {
  await withPgTransaction(async (client) => {
    const before = await sqlOne<SupportContact>(
      "select email, row_version, updated_at from public.platform_support_contact where id = true",
      [], client,
    );
    if (!before) throw new Error("Configuration du support introuvable.");
    if (before.row_version !== input.rowVersion) {
      throw new Error("L'adresse du support a été modifiée. Rechargez la page.");
    }
    const updated = await sqlOne<{ email: string }>(`update public.platform_support_contact
      set email = $1, updated_at = now(), updated_by = $2, row_version = row_version + 1
      where id = true and row_version = $3 returning email`,
      [input.email, input.actorUserId, input.rowVersion], client);
    if (!updated) throw new Error("L'adresse du support a été modifiée. Rechargez la page.");
    await recordAudit({
      actorUserId: input.actorUserId,
      action: "platform_support.update",
      entityKind: "platform_support_contact",
      before: { email: before.email, rowVersion: before.row_version },
      after: { email: updated.email, rowVersion: before.row_version + 1 },
    }, client);
  });
}
