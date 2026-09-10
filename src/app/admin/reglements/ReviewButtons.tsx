"use client";

import { useActionState } from "react";
import { reviewPlatformPayment, type ReviewState } from "@/lib/actions/admin";

const initial: ReviewState = {};

/** Validate / reject controls for one declared payment. */
export default function ReviewButtons({ paymentId }: { paymentId: string }) {
  const [state, action, pending] = useActionState(reviewPlatformPayment, initial);

  return (
    <form action={action} className="border-base-300 mt-5 border-t pt-5">
      <input type="hidden" name="paymentId" value={paymentId} />

      <label className="label-text mb-1.5 block text-sm font-medium" htmlFor={`note-${paymentId}`}>
        Note de rapprochement
      </label>
      <input
        id={`note-${paymentId}`}
        name="note"
        type="text"
        placeholder="Référence vérifiée auprès de l'opérateur…"
        className="input input-bordered input-sm w-full"
      />

      {state.error ? (
        <p role="alert" className="alert alert-error mt-3 text-sm">
          {state.error}
        </p>
      ) : null}

      {state.message ? (
        <p role="status" className="alert alert-success mt-3 text-sm">
          {state.message}
        </p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          name="decision"
          value="validate"
          disabled={pending}
          className="btn btn-primary btn-sm"
        >
          Valider et prolonger
        </button>
        <button
          type="submit"
          name="decision"
          value="reject"
          disabled={pending}
          className="btn btn-outline btn-error btn-sm"
        >
          Rejeter
        </button>
      </div>

      <p className="text-base-content/45 mt-2 text-xs">
        Le rejet exige une note explicative.
      </p>
    </form>
  );
}
