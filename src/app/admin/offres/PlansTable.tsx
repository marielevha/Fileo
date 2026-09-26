"use client";

import { useMemo, useState } from "react";
import { savePlanSettingsAction, updatePlanFlagsAction } from "@/lib/actions/plans";
import { formatMoney, money, type CurrencyCode } from "@/lib/money";
import { parseLimits } from "@/lib/plan-limits";
import type { PlanRow } from "@/lib/repos/contents";

export default function PlansTable({ plans }: { plans: PlanRow[] }) {
  const [selected, setSelected] = useState<PlanRow | null>(null);

  return (
    <section className="rounded-lg border border-base-300 bg-base-100">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-base-300 px-5 py-4">
        <div>
          <h2 className="font-display font-bold">Catalogue des offres</h2>
          <p className="mt-1 text-sm text-base-content/55">{plans.length} offre{plans.length > 1 ? "s" : ""} configurée{plans.length > 1 ? "s" : ""}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Offre</th>
              <th>Pays</th>
              <th>Prix</th>
              <th>Essai</th>
              <th>Limites</th>
              <th>Publication</th>
              <th>Statut</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => {
              const limits = parseLimits(plan.limits_json);
              return (
                <tr key={plan.id}>
                  <td>
                    <span className="font-semibold">{plan.label}</span>
                    <span className="mt-1 block text-xs text-base-content/55">{plan.code} · v{plan.version}</span>
                  </td>
                  <td>{plan.country_code}</td>
                  <td>{formatMoney(money(Number(plan.price_amount), plan.currency as CurrencyCode))}<span className="block text-xs text-base-content/55">{plan.period_months} mois</span></td>
                  <td>{plan.trial_days} j</td>
                  <td className="text-sm text-base-content/70">
                    {limits.members ?? "-"} membre{limits.members && limits.members > 1 ? "s" : ""} · {limits.templates ?? "-"} modèles
                    <span className="block text-xs text-base-content/55">{limits.storageMb ?? "-"} Mo · {limits.notifications ? "Notifications" : "Sans notifications"}</span>
                  </td>
                  <td><PlanFlagSwitch plan={plan} field="public" /></td>
                  <td><PlanFlagSwitch plan={plan} field="status" /></td>
                  <td className="text-right">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(plan)}>Modifier</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected ? <PlanModal key={selected.id} plan={selected} onClose={() => setSelected(null)} /> : null}
    </section>
  );
}

function PlanFlagSwitch({ field, plan }: { field: "public" | "status"; plan: PlanRow }) {
  const isStatus = field === "status";
  const checked = isStatus ? plan.status === "active" : plan.is_public;

  return (
    <form action={updatePlanFlagsAction} className="flex items-center gap-2">
      <input type="hidden" name="planId" value={plan.id} />
      <input type="hidden" name="status" value={isStatus ? (checked ? "archived" : "active") : (plan.status ?? "active")} />
      {isStatus && plan.is_public ? <input type="hidden" name="isPublic" value="on" /> : null}
      <input
        aria-label={isStatus ? "Changer le statut" : "Changer la visibilité publique"}
        className="toggle toggle-primary"
        defaultChecked={checked}
        name={isStatus ? undefined : "isPublic"}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        type="checkbox"
      />
      <span className="text-xs text-base-content/60">{isStatus ? (checked ? "Active" : "Archivée") : (checked ? "Publique" : "Privée")}</span>
    </form>
  );
}

function PlanModal({ onClose, plan }: { onClose: () => void; plan: PlanRow }) {
  const limits = useMemo(() => parseLimits(plan.limits_json), [plan.limits_json]);

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-4xl rounded-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-xl font-bold">Modifier l'offre</h3>
            <p className="mt-1 text-sm text-base-content/55">{plan.code} · {plan.country_code} · {plan.currency}</p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>Fermer</button>
        </div>

        <form action={savePlanSettingsAction} className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <input type="hidden" name="planId" value={plan.id} />
          <label className="form-control md:col-span-2">
            <span className="label-text mb-1.5 font-medium">Libellé</span>
            <input name="label" defaultValue={plan.label} className="input input-bordered" required maxLength={80} />
          </label>
          <label className="form-control">
            <span className="label-text mb-1.5 font-medium">Prix ({plan.currency})</span>
            <input name="priceAmount" type="number" min={0} defaultValue={plan.price_amount} className="input input-bordered" required />
          </label>
          <label className="form-control">
            <span className="label-text mb-1.5 font-medium">Statut</span>
            <select name="status" defaultValue={plan.status ?? "active"} className="select select-bordered">
              <option value="active">Active</option>
              <option value="archived">Archivée</option>
            </select>
          </label>
          <label className="form-control">
            <span className="label-text mb-1.5 font-medium">Durée abonnement</span>
            <input name="periodMonths" type="number" min={1} defaultValue={plan.period_months} className="input input-bordered" required />
          </label>
          <label className="form-control">
            <span className="label-text mb-1.5 font-medium">Essai gratuit</span>
            <input name="trialDays" type="number" min={0} max={365} defaultValue={plan.trial_days} className="input input-bordered" required />
          </label>
          <label className="form-control">
            <span className="label-text mb-1.5 font-medium">Membres</span>
            <input name="members" type="number" min={1} defaultValue={limits.members ?? 1} className="input input-bordered" required />
          </label>
          <label className="form-control">
            <span className="label-text mb-1.5 font-medium">Modèles</span>
            <input name="templates" type="number" min={0} defaultValue={limits.templates ?? 0} className="input input-bordered" required />
          </label>
          <label className="form-control">
            <span className="label-text mb-1.5 font-medium">Stockage photos (Mo)</span>
            <input name="storageMb" type="number" min={0} defaultValue={limits.storageMb ?? 0} className="input input-bordered" required />
          </label>
          <div className="grid gap-3 md:col-span-2 xl:col-span-3">
            <label className="flex items-center gap-3">
              <input name="isPublic" type="checkbox" defaultChecked={plan.is_public} className="checkbox checkbox-primary" />
              <span className="font-medium">Afficher cette offre publiquement</span>
            </label>
            <label className="flex items-center gap-3">
              <input name="notifications" type="checkbox" defaultChecked={limits.notifications} className="checkbox checkbox-primary" />
              <span className="font-medium">Notifications incluses</span>
            </label>
          </div>
          <div className="modal-action md:col-span-2 xl:col-span-4">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary">Enregistrer</button>
          </div>
        </form>
      </div>
      <div aria-hidden="true" className="modal-backdrop">close</div>
    </div>
  );
}
