"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { saveFaqTranslation, type FaqStatus } from "@/lib/repos/faq";

export type FaqFormState = { error?: string; success?: boolean; slug?: string; locale?: Locale };

export async function saveFaq(
  _previous: FaqFormState,
  formData: FormData,
): Promise<FaqFormState> {
  const session = await requireAdmin("admin.contents");
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const localeValue = String(formData.get("locale") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const status = String(formData.get("status") ?? "");
  const sortOrder = Number(formData.get("sortOrder"));
  const rawVersion = String(formData.get("rowVersion") ?? "");
  const rowVersion = rawVersion === "" ? null : Number(rawVersion);

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) {
    return { error: "L'identifiant doit contenir uniquement des lettres minuscules, chiffres et tirets." };
  }
  if (!isLocale(localeValue)) return { error: "Langue non prise en charge." };
  if (title.length < 5 || title.length > 200) return { error: "La question doit contenir entre 5 et 200 caractères." };
  if (body.length < 5 || body.length > 5000) return { error: "La réponse doit contenir entre 5 et 5 000 caractères." };
  if (!["draft", "published", "archived"].includes(status)) return { error: "Statut invalide." };
  if (!Number.isSafeInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999) return { error: "Ordre invalide." };
  if (rowVersion !== null && (!Number.isSafeInteger(rowVersion) || rowVersion < 1)) return { error: "Version invalide." };

  try {
    await saveFaqTranslation({ slug, locale: localeValue, title, body, sortOrder,
      status: status as FaqStatus, rowVersion, actorUserId: session.user.id });
    revalidatePath("/", "layout");
    return { success: true, slug, locale: localeValue };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Enregistrement impossible." };
  }
}
