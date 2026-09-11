"use server";

import { redirect } from "next/navigation";
import { recordAudit } from "@/lib/audit";
import { requireWorkshop } from "@/lib/auth/guards";
import { collection, newId, nowIso, withTransaction } from "@/lib/db";
import { localePath } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/request";
import {
  getPlanningItemForUpdate,
  isActivePlanningMember,
} from "@/lib/repos/planning";
import { ITEM_STATUSES, type ItemStatus } from "@/lib/repos/orders";

export type PlanningItemActionState = { error?: string; success?: string };

const STATUS_RANK: Record<ItemStatus, number> = {
  a_realiser: 0,
  en_cours: 1,
  a_essayer: 2,
  pret: 3,
  remis: 4,
  annule: 5,
};

function parseDate(value: FormDataEntryValue | null): string | null | undefined {
  const date = String(value ?? "").trim();
  if (!date) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return undefined;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date
    ? undefined
    : date;
}

export async function updatePlanningItemAction(
  itemId: string,
  _previous: PlanningItemActionState,
  formData: FormData,
): Promise<PlanningItemActionState> {
  const session = await requireWorkshop("orders.write");
  const item = await getPlanningItemForUpdate(session.workshop.id, itemId);
  if (!item) return { error: "Cet article n'existe plus ou n'est pas accessible." };

  const statusValue = String(formData.get("status") ?? "");
  if (!ITEM_STATUSES.includes(statusValue as ItemStatus)) {
    return { error: "L'état sélectionné est invalide." };
  }
  const status = statusValue as ItemStatus;
  const dueDate = parseDate(formData.get("dueDate"));
  if (dueDate === undefined) return { error: "La date d'échéance est invalide." };

  const rawAssignee = String(formData.get("assigneeId") ?? "").trim();
  const assigneeId = rawAssignee || null;
  if (assigneeId && !(await isActivePlanningMember(session.workshop.id, assigneeId))) {
    return { error: "Le collaborateur sélectionné n'est plus actif dans cet atelier." };
  }

  const expectedVersion = Number(formData.get("rowVersion"));
  if (!Number.isInteger(expectedVersion) || expectedVersion !== item.row_version) {
    return { error: "Cette tâche a été modifiée ailleurs. Rechargez la page avant de réessayer." };
  }

  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  const dateChanged = dueDate !== item.due_date;
  const statusChanged = status !== item.status;
  const assignmentChanged = assigneeId !== item.assignee_user_id;
  const isBackward = statusChanged && STATUS_RANK[status] < STATUS_RANK[item.status];
  const needsReason = dateChanged || isBackward || status === "annule" || item.status === "annule";

  if (needsReason && reason.length < 3) {
    return { error: "Indiquez un motif d'au moins 3 caractères pour ce changement." };
  }
  if (!dateChanged && !statusChanged && !assignmentChanged) {
    return { success: "Aucun changement à enregistrer." };
  }

  const changedAt = nowIso();
  try {
    await withTransaction(async (mongoSession) => {
      const deliveredAt = status === "remis"
        ? item.delivered_at ?? changedAt
        : item.status === "remis"
          ? null
          : item.delivered_at;
      const cancelledAt = status === "annule"
        ? item.cancelled_at ?? changedAt
        : item.status === "annule"
          ? null
          : item.cancelled_at;
      const deliveredQuantity = status === "remis" ? item.quantity : item.status === "remis" ? 0 : undefined;

      const items = await collection("order_items");
      const set: Record<string, unknown> = {
        status, due_date: dueDate, assignee_user_id: assigneeId,
        delivered_at: deliveredAt, cancelled_at: cancelledAt, updated_at: changedAt,
      };
      if (deliveredQuantity !== undefined) set.delivered_quantity = deliveredQuantity;
      const result = await items.updateOne(
        { id: item.item_id, workshop_id: session.workshop.id, row_version: expectedVersion },
        { $set: set, $inc: { row_version: 1 } },
        { session: mongoSession },
      );
      if (result.modifiedCount !== 1) throw new Error("planning_conflict");

      if (dateChanged) {
        const changes = await collection("order_date_changes");
        await changes.insertOne({
          id: newId(), workshop_id: session.workshop.id, order_id: item.order_id,
          order_item_id: item.item_id, previous_date: item.due_date, new_date: dueDate,
          reason, changed_by: session.user.id, changed_at: changedAt,
        }, { session: mongoSession });
        await recordAudit({
          workshopId: session.workshop.id,
          actorUserId: session.user.id,
          action: "order.date_change",
          entityKind: "order_item",
          entityId: item.item_id,
          reason,
          before: { dueDate: item.due_date },
          after: { dueDate },
        }, mongoSession);
      }

      if (statusChanged) {
        await recordAudit({
          workshopId: session.workshop.id,
          actorUserId: session.user.id,
          action: "item.status_change",
          entityKind: "order_item",
          entityId: item.item_id,
          reason: reason || null,
          before: { status: item.status },
          after: { status, deliveredAt },
        }, mongoSession);
      }

      if (assignmentChanged) {
        await recordAudit({
          workshopId: session.workshop.id,
          actorUserId: session.user.id,
          action: "item.update",
          entityKind: "order_item",
          entityId: item.item_id,
          before: { assigneeUserId: item.assignee_user_id },
          after: { assigneeUserId: assigneeId },
        }, mongoSession);
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "planning_conflict") {
      return { error: "Cette tâche vient d'être modifiée. Rechargez la page avant de réessayer." };
    }
    throw error;
  }

  const locale = await getLocale();
  const requestedReturnTo = String(formData.get("returnTo") ?? "");
  const returnTo = /^\/(?:fr|en|lg)\/atelier\/planning(?:\?[^#]*)?$/.test(requestedReturnTo)
    ? requestedReturnTo
    : localePath(locale, "/atelier/planning");
  redirect(returnTo);
}
