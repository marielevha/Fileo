"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/guards";
import { rejectPlatformPayment, validatePlatformPayment } from "@/lib/repos/admin";

export type ReviewState = { error?: string; message?: string };

/**
 * Validates or rejects a declared subscription payment (§11.3, §12.3).
 *
 * The guard runs inside the action, not only in the page: a server action is
 * a public endpoint and must re-check the caller's habilitation.
 */
export async function reviewPlatformPayment(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const session = await requireAdmin("admin.payments.validate");

  const paymentId = String(formData.get("paymentId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!paymentId) return { error: "Règlement introuvable." };

  try {
    if (decision === "validate") {
      const { alreadyValidated } = await validatePlatformPayment({
        paymentId,
        reviewerUserId: session.user.id,
        note: note || null,
      });

      revalidatePath("/admin/reglements");

      // REC-17: validating the same reference twice extends the period once.
      return {
        message: alreadyValidated
          ? "Ce règlement était déjà validé. Aucune prolongation supplémentaire n'a été appliquée."
          : "Règlement validé et abonnement prolongé.",
      };
    }

    if (decision === "reject") {
      if (!note) return { error: "Un motif est obligatoire pour rejeter un règlement." };

      await rejectPlatformPayment({ paymentId, reviewerUserId: session.user.id, note });
      revalidatePath("/admin/reglements");

      return { message: "Règlement rejeté." };
    }

    return { error: "Action inconnue." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Le traitement a échoué.",
    };
  }
}
