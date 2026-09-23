"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { updateSupportContact } from "@/lib/repos/support-contact";

export type SupportContactFormState = { error?: string; success?: boolean };

export async function saveSupportContact(
  _previous: SupportContactFormState,
  formData: FormData,
): Promise<SupportContactFormState> {
  const session = await requireAdmin("admin.settings");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const rowVersion = Number(formData.get("rowVersion"));
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Saisissez une adresse email valide." };
  }
  if (!Number.isSafeInteger(rowVersion) || rowVersion < 1) {
    return { error: "Version invalide. Rechargez la page." };
  }
  try {
    await updateSupportContact({ email, rowVersion, actorUserId: session.user.id });
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Enregistrement impossible." };
  }
}
