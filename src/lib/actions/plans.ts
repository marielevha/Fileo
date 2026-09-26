"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { getLocale } from "@/lib/i18n/request";
import { localePath } from "@/lib/i18n/config";
import { updatePlanFlags, updatePlanSettings } from "@/lib/repos/contents";

function positiveInt(formData: FormData, key: string, label: string, max = 1_000_000) {
  const value = Number.parseInt(String(formData.get(key) ?? ""), 10);
  if (!Number.isSafeInteger(value) || value < 0 || value > max) {
    throw new Error(`${label} invalide.`);
  }
  return value;
}

export async function savePlanSettingsAction(formData: FormData) {
  const session = await requireAdmin("admin.subscriptions");
  const locale = await getLocale();
  const planId = String(formData.get("planId") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const status = String(formData.get("status") ?? "active");
  if (!planId) throw new Error("Offre introuvable.");
  if (label.length < 2 || label.length > 80) throw new Error("Libelle invalide.");
  if (status !== "active" && status !== "archived") throw new Error("Statut invalide.");

  await updatePlanSettings({
    planId,
    actorUserId: session.user.id,
    label,
    priceAmount: positiveInt(formData, "priceAmount", "Prix", 100_000_000),
    periodMonths: Math.max(1, positiveInt(formData, "periodMonths", "Duree", 120)),
    trialDays: positiveInt(formData, "trialDays", "Duree d'essai", 365),
    members: Math.max(1, positiveInt(formData, "members", "Membres", 10_000)),
    templates: positiveInt(formData, "templates", "Modeles", 10_000),
    storageMb: positiveInt(formData, "storageMb", "Stockage", 1_000_000),
    notifications: formData.get("notifications") === "on",
    isPublic: formData.get("isPublic") === "on",
    status,
  });

  revalidatePath(localePath(locale, "/admin/offres"));
  revalidatePath(localePath(locale, "/"));
  revalidatePath("/", "layout");
}

export async function updatePlanFlagsAction(formData: FormData) {
  const session = await requireAdmin("admin.subscriptions");
  const locale = await getLocale();
  const planId = String(formData.get("planId") ?? "").trim();
  const status = String(formData.get("status") ?? "active");
  if (!planId) throw new Error("Offre introuvable.");
  if (status !== "active" && status !== "archived") throw new Error("Statut invalide.");
  await updatePlanFlags({
    planId,
    actorUserId: session.user.id,
    isPublic: formData.get("isPublic") === "on",
    status,
  });
  revalidatePath(localePath(locale, "/admin/offres"));
  revalidatePath(localePath(locale, "/"));
  revalidatePath("/", "layout");
}
