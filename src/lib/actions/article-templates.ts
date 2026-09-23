"use server";

import { revalidatePath } from "next/cache";
import { requireWorkshop } from "@/lib/auth/guards";
import { localePath } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/request";
import { deleteArticleTemplate, saveArticleTemplate, type MeasurementTemplateField } from "@/lib/repos/article-templates";
import { updateWorkshopMeasurementUnits } from "@/lib/repos/workshops";

function parseFields(text: FormDataEntryValue | null): MeasurementTemplateField[] {
  return String(text ?? "")
    .split(/\r?\n/)
    .map((line, index) => {
      const raw = line.trim();
      if (!raw) return null;
      const [labelPart, unitPart] = raw.split("|", 2);
      const label = labelPart.trim();
      if (!label) return null;
      return {
        key: label.toLocaleLowerCase("fr-FR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || `mesure_${index + 1}`,
        label,
        unit: unitPart?.trim() || "cm",
        required: false,
        sortOrder: index + 1,
      };
    })
    .filter((field): field is MeasurementTemplateField => Boolean(field));
}

export async function saveArticleTemplateAction(formData: FormData) {
  const session = await requireWorkshop("templates.manage");
  const locale = await getLocale();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 80) throw new Error("Le nom du modele doit contenir entre 2 et 80 caracteres.");
  const workType = String(formData.get("defaultWorkType") ?? "creation");
  if (workType !== "creation" && workType !== "retouche") throw new Error("Type de travail invalide.");
  await saveArticleTemplate({
    workshopId: session.workshop.id,
    actorUserId: session.user.id,
    id: String(formData.get("id") ?? "").trim() || null,
    name,
    description: String(formData.get("description") ?? "").trim() || null,
    defaultWorkType: workType,
    active: formData.get("active") === "on",
    sortOrder: Math.max(0, Number.parseInt(String(formData.get("sortOrder") ?? "0"), 10) || 0),
    fields: parseFields(formData.get("fields")),
  });
  revalidatePath(localePath(locale, "/atelier/parametres"));
}

export async function deleteArticleTemplateAction(formData: FormData) {
  const session = await requireWorkshop("templates.manage");
  const locale = await getLocale();
  const id = String(formData.get("id") ?? "").trim();
  if (id) await deleteArticleTemplate({ workshopId: session.workshop.id, actorUserId: session.user.id, id });
  revalidatePath(localePath(locale, "/atelier/parametres"));
}

export async function saveMeasurementUnitsAction(formData: FormData) {
  const session = await requireWorkshop("templates.manage");
  const locale = await getLocale();
  await updateWorkshopMeasurementUnits({
    workshopId: session.workshop.id,
    actorUserId: session.user.id,
    units: formData.get("measurementUnits"),
  });
  revalidatePath(localePath(locale, "/atelier/parametres"));
  revalidatePath(localePath(locale, "/atelier/commandes/nouvelle"));
}
