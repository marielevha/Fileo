"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import { reviewPlatformPayment, type ReviewState } from "@/lib/actions/admin";

const initial: ReviewState = {};
type Decision = "validate" | "reject";

/** Validate / reject controls for one declared payment. */
export default function ReviewButtons({
  paymentId,
  canReview,
}: {
  paymentId: string;
  canReview: boolean;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(reviewPlatformPayment, initial);
  const [decision, setDecision] = useState<Decision>("validate");
  const [confirmDecision, setConfirmDecision] = useState<Decision | null>(null);
  const [result, setResult] = useState<null | { kind: "success" | "error"; message: string }>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.message) {
      setResult({ kind: "success", message: state.message });
    } else if (state.error) {
      setResult({ kind: "error", message: state.error });
    }
  }, [state.message, state.error]);

  function askConfirmation(nextDecision: Decision) {
    setDecision(nextDecision);
    setConfirmDecision(nextDecision);
  }

  function confirmReview() {
    setConfirmDecision(null);
    requestAnimationFrame(() => formRef.current?.requestSubmit());
  }

  function closeResult() {
    const shouldRefresh = result?.kind === "success";
    setResult(null);
    if (shouldRefresh) router.refresh();
  }

  if (!canReview && !result) return null;

  return (
    <form
      ref={formRef}
      action={action}
      className={canReview ? "border-base-300 mt-5 border-t pt-5" : ""}
    >
      <input type="hidden" name="paymentId" value={paymentId} />
      <input type="hidden" name="decision" value={decision} />

      {canReview ? (
        <>
          <label className="label-text mb-1.5 block text-sm font-medium" htmlFor={`note-${paymentId}`}>
            Note de rapprochement
          </label>
          <input
            id={`note-${paymentId}`}
            name="note"
            type="text"
            placeholder="Référence vérifiée auprès de l'opérateur..."
            className="input input-bordered input-sm w-full"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              className="btn btn-primary btn-sm gap-2"
              onClick={() => askConfirmation("validate")}
            >
              <Icon name="check" className="h-4 w-4" />
              Valider et prolonger
            </button>
            <button
              type="button"
              disabled={pending}
              className="btn btn-outline btn-error btn-sm gap-2"
              onClick={() => askConfirmation("reject")}
            >
              <Icon name="close" className="h-4 w-4" />
              Rejeter
            </button>
          </div>

          <p className="text-base-content/45 mt-2 text-xs">
            Le rejet exige une note explicative.
          </p>
        </>
      ) : null}

      {confirmDecision ? (
        <ReviewModal
          kind={confirmDecision === "validate" ? "success" : "warning"}
          title={confirmDecision === "validate" ? "Valider ce règlement ?" : "Rejeter ce règlement ?"}
          message={
            confirmDecision === "validate"
              ? "L'abonnement sera prolongé après confirmation de cette validation."
              : "Ce paiement sera marqué comme rejeté. Vérifiez que la note explique clairement le motif."
          }
          primaryLabel={confirmDecision === "validate" ? "Confirmer la validation" : "Confirmer le rejet"}
          pending={pending}
          onCancel={() => setConfirmDecision(null)}
          onConfirm={confirmReview}
        />
      ) : null}

      {result ? (
        <ReviewModal
          kind={result.kind === "success" ? "success" : "error"}
          title={result.kind === "success" ? "Opération réussie" : "Action impossible"}
          message={result.message}
          primaryLabel="Compris"
          onConfirm={closeResult}
        />
      ) : null}
    </form>
  );
}

function ReviewModal({
  kind,
  title,
  message,
  primaryLabel,
  pending = false,
  onCancel,
  onConfirm,
}: {
  kind: "success" | "warning" | "error";
  title: string;
  message: string;
  primaryLabel: string;
  pending?: boolean;
  onCancel?: () => void;
  onConfirm: () => void;
}) {
  const iconName = kind === "success" ? "check" : kind === "warning" ? "shield" : "close";
  const tone =
    kind === "success"
      ? "text-success bg-success/15"
      : kind === "warning"
        ? "text-warning bg-warning/15"
        : "text-error bg-error/15";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral/55 px-4">
      <div className="w-full max-w-md rounded-2xl border border-base-300 bg-base-100 p-6 text-left shadow-2xl">
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${tone}`}>
            <Icon name={iconName} className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-bold">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-base-content/70">{message}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          {onCancel ? (
            <button type="button" className="btn btn-ghost btn-sm" disabled={pending} onClick={onCancel}>
              Annuler
            </button>
          ) : null}
          <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={onConfirm}>
            {pending ? <span className="loading loading-spinner loading-xs" /> : null}
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
