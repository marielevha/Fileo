"use server";

import { revalidatePath } from "next/cache";
import { requireWorkshop } from "@/lib/auth/guards";
import { getLocale } from "@/lib/i18n/request";
import { localePath } from "@/lib/i18n/config";
import { isCountryCode, parsePhone } from "@/lib/phone";
import type { WorkshopRole } from "@/lib/permissions";
import {
  addExistingMember,
  removeTeamMember,
  TeamError,
  toggleTeamMemberStatus,
  updateTeamMember,
  type TeamStatus,
} from "@/lib/repos/team";

export type TeamActionState = { error?: string; ok?: boolean };

export async function addMemberAction(
  _previous: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const session = await requireWorkshop("team.manage");
  const locale = await getLocale();
  const rawPhone = String(formData.get("phone") ?? "");
  const role = parseRole(String(formData.get("role") ?? "collaborator"));
  if (!isCountryCode(session.workshop.countryCode)) return { error: "Pays de l'atelier invalide." };
  const phone = parsePhone(rawPhone, session.workshop.countryCode);
  if (!phone.ok) return { error: phone.error };

  try {
    await addExistingMember({
      workshopId: session.workshop.id,
      actorUserId: session.user.id,
      phoneE164: phone.e164,
      role,
      canViewMoney: formData.get("canViewMoney") === "on",
    });
  } catch (error) {
    return { error: error instanceof TeamError ? error.message : "Impossible d'ajouter ce membre." };
  }

  revalidatePath(localePath(locale, "/atelier/equipe"));
  return { ok: true };
}

export async function updateMemberAction(
  _previous: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const session = await requireWorkshop("team.manage");
  const locale = await getLocale();
  const membershipId = String(formData.get("membershipId") ?? "");
  if (!membershipId) return { error: "Membre introuvable." };

  try {
    await updateTeamMember({
      workshopId: session.workshop.id,
      actorUserId: session.user.id,
      membershipId,
      role: parseRole(String(formData.get("role") ?? "collaborator")),
      status: parseStatus(String(formData.get("status") ?? "active")),
      canViewMoney: formData.get("canViewMoney") === "on",
    });
  } catch (error) {
    return { error: error instanceof TeamError ? error.message : "Impossible de modifier ce membre." };
  }

  revalidatePath(localePath(locale, "/atelier/equipe"));
  return { ok: true };
}

export async function removeMemberAction(
  _previous: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const session = await requireWorkshop("team.manage");
  const locale = await getLocale();
  const membershipId = String(formData.get("membershipId") ?? "");
  if (!membershipId) return { error: "Membre introuvable." };

  try {
    await removeTeamMember({
      workshopId: session.workshop.id,
      actorUserId: session.user.id,
      membershipId,
    });
  } catch (error) {
    return { error: error instanceof TeamError ? error.message : "Impossible de retirer ce membre." };
  }

  revalidatePath(localePath(locale, "/atelier/equipe"));
  return { ok: true };
}

export async function toggleMemberStatusAction(
  _previous: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const session = await requireWorkshop("team.manage");
  const locale = await getLocale();
  const membershipId = String(formData.get("membershipId") ?? "");
  if (!membershipId) return { error: "Membre introuvable." };

  try {
    await toggleTeamMemberStatus({
      workshopId: session.workshop.id,
      actorUserId: session.user.id,
      membershipId,
      active: formData.get("active") === "on",
    });
  } catch (error) {
    return { error: error instanceof TeamError ? error.message : "Impossible de modifier le statut." };
  }

  revalidatePath(localePath(locale, "/atelier/equipe"));
  return { ok: true };
}

function parseRole(value: string): WorkshopRole {
  return value === "owner" ? "owner" : "collaborator";
}

function parseStatus(value: string): TeamStatus {
  if (value === "disabled" || value === "invited") return value;
  return "active";
}
