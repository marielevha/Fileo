"use client";

import { useActionState, useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import {
  declareSubscriptionPaymentAction,
  type SubscriptionPaymentState,
} from "@/lib/actions/subscriptions";

const initial: SubscriptionPaymentState = {};
const PAYMENT_CHANNELS = [
  ["mobile_money", "MTN MoMo"],
  ["airtel_money", "Airtel Money"],
  ["transfer", "Virement"],
  ["cash", "Espèces"],
] as const;

export type PaymentPlanOption = {
  id: string;
  label: string;
  amount: string;
  priceLabel: string;
  periodLabel: string;
  membersLabel: string;
  currency: string;
  current: boolean;
};

export default function DeclarePaymentForm({
  currency,
  plans,
  today,
  idempotencyKey,
}: {
  currency: string;
  plans: PaymentPlanOption[];
  today: string;
  idempotencyKey: string;
}) {
  const [state, action, pending] = useActionState(declareSubscriptionPaymentAction, initial);
  const [modal, setModal] = useState<null | { kind: "success" | "error"; message: string }>(null);
  const firstPlan = plans.find((plan) => plan.current) ?? plans[0];
  const [selectedPlanId, setSelectedPlanId] = useState(firstPlan?.id ?? "");
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? firstPlan;
  const [amount, setAmount] = useState(selectedPlan?.amount ?? "");

  useEffect(() => {
    if (state.ok) {
      setModal({ kind: "success", message: "Paiement déclaré. Il sera validé par l'équipe Filéo." });
    } else if (state.error) {
      setModal({ kind: "error", message: state.error });
    }
  }, [state.ok, state.error]);

  function updatePlan(nextPlanId: string) {
    const nextPlan = plans.find((plan) => plan.id === nextPlanId);
    setSelectedPlanId(nextPlanId);
    if (nextPlan) setAmount(nextPlan.amount);
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="planId" value={selectedPlan?.id ?? ""} />
      <input type="hidden" name="currency" value={currency} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <label className="block">
        <span className="label-text mb-2.5 block text-xs font-medium">Offre</span>
        <select
          value={selectedPlan?.id ?? ""}
          onChange={(event) => updatePlan(event.target.value)}
          className="select select-bordered select-sm w-full"
          required
        >
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.label} - {plan.priceLabel}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label-text mb-2.5 block text-xs font-medium">Montant payé</span>
          <input
            name="amount"
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="input input-bordered input-sm w-full"
            required
          />
        </label>

        <label className="block">
          <span className="label-text mb-2.5 block text-xs font-medium">Moyen</span>
          <select name="channel" defaultValue="mobile_money" className="select select-bordered select-sm w-full">
            {PAYMENT_CHANNELS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label-text mb-2.5 block text-xs font-medium">Référence transaction</span>
          <input
            name="externalReference"
            type="text"
            maxLength={120}
            className="input input-bordered input-sm w-full"
            placeholder="Ex. MTN-123456"
            required
          />
        </label>

        <label className="block">
          <span className="label-text mb-2.5 block text-xs font-medium">Date</span>
          <input
            name="declaredAt"
            type="date"
            defaultValue={today}
            max={today}
            className="input input-bordered input-sm w-full"
            required
          />
        </label>
      </div>

      <label className="block">
        <span className="label-text mb-2.5 block text-xs font-medium">Note</span>
        <input
          name="note"
          type="text"
          maxLength={240}
          className="input input-bordered input-sm w-full"
          placeholder="Nom payeur, numéro utilisé..."
        />
      </label>

      <div className="pt-1">
        <button type="submit" className="btn btn-primary btn-sm w-full gap-2" disabled={pending}>
          {pending ? <span className="loading loading-spinner loading-xs" /> : <Icon name="check" className="h-4 w-4" />}
          Déclarer le paiement
        </button>
      </div>

      {modal ? (
        <SubscriptionPaymentModal
          kind={modal.kind}
          message={modal.message}
          onClose={() => setModal(null)}
        />
      ) : null}
    </form>
  );
}

function SubscriptionPaymentModal({
  kind,
  message,
  onClose,
}: {
  kind: "success" | "error";
  message: string;
  onClose: () => void;
}) {
  const success = kind === "success";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral/55 px-4">
      <div className="w-full max-w-md rounded-2xl border border-base-300 bg-base-100 p-6 text-left shadow-2xl">
        <div className="flex items-start gap-3">
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${success ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
            <Icon name={success ? "check" : "shield"} className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-bold">
              {success ? "Paiement déclaré" : "Action impossible"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-base-content/70">{message}</p>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
            Compris
          </button>
        </div>
      </div>
    </div>
  );
}
