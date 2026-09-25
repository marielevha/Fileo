"use client";

import { useActionState, useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import {
  checkMomoSubscriptionPaymentAction,
  declareSubscriptionPaymentAction,
  startMomoSubscriptionPaymentAction,
  type MomoPaymentState,
  type SubscriptionPaymentState,
} from "@/lib/actions/subscriptions";

const initialManual: SubscriptionPaymentState = {};
const initialMomo: MomoPaymentState = {};
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
  basePriceLabel?: string;
  affiliateDiscount?: boolean;
  affiliateDiscountLabel?: string;
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
  const [manualState, manualAction, manualPending] = useActionState(declareSubscriptionPaymentAction, initialManual);
  const [momoState, momoAction, momoPending] = useActionState(startMomoSubscriptionPaymentAction, initialMomo);
  const [checkState, checkAction, checkPending] = useActionState(checkMomoSubscriptionPaymentAction, initialMomo);
  const [mode, setMode] = useState<"momo" | "manual">("momo");
  const [modal, setModal] = useState<null | { kind: "success" | "error"; message: string }>(null);
  const firstPlan = plans.find((plan) => plan.current) ?? plans[0];
  const [selectedPlanId, setSelectedPlanId] = useState(firstPlan?.id ?? "");
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? firstPlan;
  const [amount, setAmount] = useState(selectedPlan?.amount ?? "");
  const activeMomoPaymentId = checkState.paymentId ?? momoState.paymentId;

  useEffect(() => {
    if (manualState.ok) {
      setModal({ kind: "success", message: "Paiement déclaré. Il sera validé par l'équipe Filéo." });
    } else if (manualState.error) {
      setModal({ kind: "error", message: manualState.error });
    }
  }, [manualState.ok, manualState.error]);

  useEffect(() => {
    if (momoState.message) {
      setModal({ kind: "success", message: momoState.message });
    } else if (momoState.error) {
      setModal({ kind: "error", message: momoState.error });
    }
  }, [momoState.message, momoState.error]);

  useEffect(() => {
    if (checkState.message) {
      setModal({ kind: "success", message: checkState.message });
    } else if (checkState.error) {
      setModal({ kind: "error", message: checkState.error });
    }
  }, [checkState.message, checkState.error]);

  function updatePlan(nextPlanId: string) {
    const nextPlan = plans.find((plan) => plan.id === nextPlanId);
    setSelectedPlanId(nextPlanId);
    if (nextPlan) setAmount(nextPlan.amount);
  }

  return (
    <div className="space-y-5">
      <div className="join grid grid-cols-2">
        <button
          type="button"
          className={`btn join-item btn-sm ${mode === "momo" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setMode("momo")}
        >
          MTN MoMo
        </button>
        <button
          type="button"
          className={`btn join-item btn-sm ${mode === "manual" ? "btn-primary" : "btn-outline"}`}
          onClick={() => setMode("manual")}
        >
          Manuel
        </button>
      </div>

      <PlanAndAmountFields
        plans={plans}
        selectedPlan={selectedPlan}
        selectedPlanId={selectedPlanId}
        amount={amount}
        onPlanChange={updatePlan}
        onAmountChange={setAmount}
      />

      <form action={momoAction} className={mode === "momo" ? "space-y-5" : "hidden"}>
        <input type="hidden" name="planId" value={selectedPlan?.id ?? ""} />
        <input type="hidden" name="currency" value={currency} />
        <input type="hidden" name="amount" value={amount} />
        <input type="hidden" name="idempotencyKey" value={`${idempotencyKey}-momo`} />

        <label className="block">
          <span className="label-text mb-2.5 block text-xs font-medium">Numéro MTN MoMo</span>
          <input
            name="payerPhone"
            type="tel"
            className="input input-bordered input-sm w-full"
            placeholder="Ex. 06 123 45 67"
            required
          />
        </label>

        <button type="submit" className="btn btn-primary btn-sm w-full gap-2" disabled={momoPending}>
          {momoPending ? <span className="loading loading-spinner loading-xs" /> : <Icon name="phone" className="h-4 w-4" />}
          Payer avec MTN MoMo
        </button>
      </form>

      {activeMomoPaymentId ? (
        <form action={checkAction} className={mode === "momo" ? "space-y-3" : "hidden"}>
          <input type="hidden" name="paymentId" value={activeMomoPaymentId} />
          <button type="submit" className="btn btn-outline btn-sm w-full gap-2" disabled={checkPending}>
            {checkPending ? <span className="loading loading-spinner loading-xs" /> : <Icon name="clock" className="h-4 w-4" />}
            Vérifier le paiement
          </button>
          <p className="text-xs text-base-content/55">
            Après confirmation sur le téléphone, vérifiez le statut pour activer ou planifier l&apos;abonnement.
          </p>
        </form>
      ) : null}

      <form action={manualAction} className={mode === "manual" ? "space-y-5" : "hidden"}>
        <input type="hidden" name="planId" value={selectedPlan?.id ?? ""} />
        <input type="hidden" name="currency" value={currency} />
        <input type="hidden" name="amount" value={amount} />
        <input type="hidden" name="idempotencyKey" value={`${idempotencyKey}-manual`} />

        <div className="grid gap-4 sm:grid-cols-2">
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
          <span className="label-text mb-2.5 block text-xs font-medium">Note</span>
          <input
            name="note"
            type="text"
            maxLength={240}
            className="input input-bordered input-sm w-full"
            placeholder="Nom payeur, numéro utilisé..."
          />
        </label>

        <button type="submit" className="btn btn-primary btn-sm w-full gap-2" disabled={manualPending}>
          {manualPending ? <span className="loading loading-spinner loading-xs" /> : <Icon name="check" className="h-4 w-4" />}
          Déclarer le paiement
        </button>
      </form>

      {modal ? (
        <SubscriptionPaymentModal
          kind={modal.kind}
          message={modal.message}
          onClose={() => setModal(null)}
        />
      ) : null}
    </div>
  );
}

function PlanAndAmountFields({
  plans,
  selectedPlan,
  selectedPlanId,
  amount,
  onPlanChange,
  onAmountChange,
}: {
  plans: PaymentPlanOption[];
  selectedPlan: PaymentPlanOption | undefined;
  selectedPlanId: string;
  amount: string;
  onPlanChange: (planId: string) => void;
  onAmountChange: (amount: string) => void;
}) {
  return (
    <div className="space-y-5">
      <label className="block">
        <span className="label-text mb-2.5 block text-xs font-medium">Offre</span>
        <select
          value={selectedPlan?.id ?? selectedPlanId}
          onChange={(event) => onPlanChange(event.target.value)}
          className="select select-bordered select-sm w-full"
          required
        >
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.label} - {plan.priceLabel}{plan.affiliateDiscount ? ` (${plan.affiliateDiscountLabel ?? "avantage affilié"})` : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="label-text mb-2.5 block text-xs font-medium">Montant payé</span>
        {selectedPlan?.affiliateDiscount ? (
          <span className="mb-2 block text-xs text-success">
            Avantage affilié appliqué : {selectedPlan.basePriceLabel} → {selectedPlan.priceLabel}
          </span>
        ) : null}
        <input
          name="amountDisplay"
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(event) => onAmountChange(event.target.value)}
          className="input input-bordered input-sm w-full"
          required
        />
      </label>
    </div>
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
              {success ? "Paiement traité" : "Action impossible"}
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
