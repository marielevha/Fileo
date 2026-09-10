"use client";

import { useActionState, useState } from "react";
import Icon from "@/components/ui/Icon";
import {
  recordPaymentAction,
  type PaymentFormState,
} from "@/lib/actions/payments";

export default function PaymentForm({
  orderId,
  idempotencyKey,
  currency,
  currencySymbol,
  remainingAmount,
  today,
}: {
  orderId: string;
  idempotencyKey: string;
  currency: string;
  currencySymbol: string;
  remainingAmount: string;
  today: string;
}) {
  const boundAction = recordPaymentAction.bind(null, orderId);
  const [state, formAction, pending] = useActionState<PaymentFormState, FormData>(
    boundAction,
    {},
  );
  const [amount, setAmount] = useState("");

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <label className="form-control">
        <span className="mb-1.5 flex items-center justify-between gap-3">
          <span className="label-text font-medium">Montant reçu</span>
          {Number(remainingAmount) > 0 ? (
            <button
              type="button"
              onClick={() => setAmount(remainingAmount)}
              className="btn btn-ghost btn-xs"
            >
              Utiliser le solde
            </button>
          ) : null}
        </span>
        <span className="join w-full">
          <input
            type="text"
            inputMode="decimal"
            name="amount"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0"
            autoComplete="off"
            className="input input-bordered join-item min-w-0 flex-1 text-lg font-semibold"
            required
            autoFocus
          />
          <span className="join-item flex min-w-24 items-center justify-center border border-l-0 border-base-300 bg-base-200 px-3 text-sm font-semibold">
            {currencySymbol}
          </span>
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="form-control">
          <span className="label-text mb-1.5 font-medium">Date effective</span>
          <input
            type="date"
            name="effectiveDate"
            defaultValue={today}
            max={today}
            className="input input-bordered w-full"
            required
          />
        </label>

        <label className="form-control">
          <span className="label-text mb-1.5 font-medium">Moyen</span>
          <select name="method" defaultValue="cash" className="select select-bordered w-full">
            <option value="cash">Espèces</option>
            <option value="mobile_money">Mobile money</option>
            <option value="transfer">Virement</option>
            <option value="other">Autre</option>
          </select>
        </label>
      </div>

      <label className="form-control">
        <span className="label-text mb-1.5 font-medium">Référence</span>
        <input
          type="text"
          name="reference"
          maxLength={120}
          placeholder="Transaction, reçu ou note facultative"
          className="input input-bordered w-full"
        />
      </label>

      <p className="rounded-lg border border-info/25 bg-info/10 px-4 py-3 text-sm text-base-content/70">
        Cet enregistrement confirme que l&apos;atelier a reçu {currency}. Il ne vérifie pas la transaction auprès d&apos;un opérateur externe.
      </p>

      {state.error ? <p className="alert alert-error py-3 text-sm">{state.error}</p> : null}

      <button type="submit" className="btn btn-primary w-full gap-2" disabled={pending}>
        {pending ? (
          <span className="loading loading-spinner loading-sm" />
        ) : (
          <Icon name="check" className="h-4 w-4" />
        )}
        Enregistrer l&apos;encaissement
      </button>
    </form>
  );
}
