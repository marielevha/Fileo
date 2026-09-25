"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin, requireWorkshop } from "@/lib/auth/guards";
import { localePath } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/request";
import {
  AffiliateCodeError,
  createAffiliateProfile,
  markAffiliateCommissionPaid,
  updateAffiliateProfileStatus,
  updateAffiliateProgramSettings,
  type AffiliateCommissionType,
} from "@/lib/repos/affiliates";

export type AffiliateActionState = { error?: string };

export async function joinAffiliateProgramAction(_prev: AffiliateActionState, formData: FormData): Promise<AffiliateActionState> {
  const session = await requireWorkshop();
  if (session.workshop.role !== "owner") return { error: "Seul le responsable peut rejoindre le programme." };
  const locale = await getLocale();
  try {
    await createAffiliateProfile({
      userId: session.user.id,
      displayName: session.user.fullName,
      phone: session.user.phone,
      requestedCode: String(formData.get("code") ?? ""),
      autoGenerate: formData.get("autoCode") === "on",
      actorUserId: session.user.id,
    });
  } catch (error) {
    if (error instanceof AffiliateCodeError) return { error: error.message };
    console.error("[join-affiliate]", error);
    return { error: "Impossible de creer le code affilie." };
  }
  revalidatePath(localePath(locale, "/atelier/affiliation"));
  redirect(localePath(locale, "/atelier/affiliation"));
}

export async function markAffiliateCommissionPaidAction(formData: FormData) {
  const session = await requireAdmin("admin.affiliates");
  const locale = await getLocale();
  await markAffiliateCommissionPaid({
    commissionId: String(formData.get("commissionId") ?? ""),
    actorUserId: session.user.id,
    note: String(formData.get("note") ?? ""),
  });
  revalidatePath(localePath(locale, "/admin/affiliation"));
}

function percentToBp(value: FormDataEntryValue | null) {
  const percent = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) throw new Error("Pourcentage invalide.");
  return Math.round(percent * 100);
}

function intValue(value: FormDataEntryValue | null, label: string, max = 100_000_000) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > max) throw new Error(`${label} invalide.`);
  return parsed;
}

function commissionType(value: FormDataEntryValue | null): AffiliateCommissionType {
  return value === "fixed" ? "fixed" : "percent";
}

export async function saveAffiliateProgramSettingsAction(formData: FormData) {
  const session = await requireAdmin("admin.affiliates");
  const locale = await getLocale();
  const publicTitle = String(formData.get("publicTitle") ?? "").trim();
  const publicDescription = String(formData.get("publicDescription") ?? "").trim();
  if (publicTitle.length < 3 || publicTitle.length > 120) throw new Error("Titre explicatif invalide.");
  if (publicDescription.length < 10 || publicDescription.length > 800) throw new Error("Texte explicatif invalide.");
  await updateAffiliateProgramSettings({
    actorUserId: session.user.id,
    enabled: formData.get("enabled") === "on",
    affiliate_trial_days: intValue(formData.get("affiliateTrialDays"), "Duree d'essai affiliee", 365),
    first_payment_discount_bp: percentToBp(formData.get("firstPaymentDiscountRate")),
    first_payment_commission_type: commissionType(formData.get("firstPaymentCommissionType")),
    first_payment_rate_bp: percentToBp(formData.get("firstPaymentRate")),
    first_payment_fixed_amount: intValue(formData.get("firstPaymentFixedAmount"), "Montant premier paiement"),
    sixth_month_commission_type: commissionType(formData.get("sixthMonthCommissionType")),
    sixth_month_rate_bp: percentToBp(formData.get("sixthMonthRate")),
    sixth_month_fixed_amount: intValue(formData.get("sixthMonthFixedAmount"), "Montant sixieme mois"),
    sixth_month_threshold_months: Math.max(1, intValue(formData.get("sixthMonthThresholdMonths"), "Seuil sixieme mois", 120)),
    payout_delay_days: intValue(formData.get("payoutDelayDays"), "Delai de paiement", 365),
    public_title: publicTitle,
    public_description: publicDescription,
  });
  revalidatePath(localePath(locale, "/admin/affiliation"));
  revalidatePath(localePath(locale, "/atelier/affiliation"));
  revalidatePath(localePath(locale, "/affiliation"));
  revalidatePath(localePath(locale, "/affilie"));
}

export async function updateAffiliateStatusAction(formData: FormData) {
  const session = await requireAdmin("admin.affiliates");
  const locale = await getLocale();
  const status = String(formData.get("status") ?? "");
  if (status !== "active" && status !== "suspended") throw new Error("Statut invalide.");
  await updateAffiliateProfileStatus({
    affiliateId: String(formData.get("affiliateId") ?? ""),
    status,
    actorUserId: session.user.id,
  });
  revalidatePath(localePath(locale, "/admin/affiliation"));
}
