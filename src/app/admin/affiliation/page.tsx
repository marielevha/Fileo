import type { ReactNode } from "react";
import PageHeader from "@/components/app/PageHeader";
import {
  markAffiliateCommissionPaidAction,
  saveAffiliateProgramSettingsAction,
  updateAffiliateStatusAction,
} from "@/lib/actions/affiliates";
import { requireAdmin } from "@/lib/auth/guards";
import { getAffiliateProgramSettings, listAffiliateAdminOverview } from "@/lib/repos/affiliates";

export const metadata = { title: "Affiliation", robots: { index: false, follow: false } };

export default async function AdminAffiliationPage() {
  await requireAdmin("admin.affiliates");
  const [{ affiliates, commissions }, settings] = await Promise.all([
    listAffiliateAdminOverview(),
    getAffiliateProgramSettings(),
  ]);

  return (
    <>
      <PageHeader title="Affiliation" description="Parametrez le programme, suivez les affilies et les commissions a payer." />
      <div className="grid gap-6">
        <section className="rounded-lg border border-base-300 bg-base-100 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold">Parametres du programme</h2>
              <p className="mt-1 text-sm text-base-content/60">Ces regles pilotent les avantages client, les commissions et les textes affiches aux affilies.</p>
            </div>
            <span className={`badge ${settings.enabled ? "badge-success" : "badge-ghost"}`}>{settings.enabled ? "Actif" : "Ferme"}</span>
          </div>

          <form action={saveAffiliateProgramSettingsAction} className="mt-6 space-y-5">
            <div className="rounded-lg border border-base-300 bg-base-200/30 p-4">
              <label className="flex items-start gap-3">
                <input name="enabled" type="checkbox" defaultChecked={settings.enabled} className="checkbox checkbox-primary mt-0.5" />
                <span>
                  <span className="block font-semibold">Programme ouvert aux nouvelles inscriptions affiliees</span>
                  <span className="mt-1 block text-sm text-base-content/60">Desactivez cette option pour bloquer les nouvelles creations de codes sans suspendre les affilies existants.</span>
                </span>
              </label>
            </div>

            <SettingsPanel
              description="Contenu affiche sur les pages publiques et dans l'espace affilie."
              title="Presentation publique"
            >
              <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                <label className={fieldClassName}>
                  <span className={labelClassName}>Titre public</span>
                  <input name="publicTitle" defaultValue={settings.public_title} className="input input-bordered w-full" maxLength={120} required />
                </label>
                <label className={fieldClassName}>
                  <span className={labelClassName}>Texte explicatif</span>
                  <textarea name="publicDescription" defaultValue={settings.public_description} className="textarea textarea-bordered min-h-28 w-full" maxLength={800} required />
                </label>
              </div>
            </SettingsPanel>

            <div className="grid gap-5 2xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
              <SettingsPanel
                description="Avantages accordes a l'atelier qui s'inscrit avec un code valide."
                title="Avantages atelier"
              >
                <div className="grid gap-4 lg:grid-cols-2">
                  <label className={fieldClassName}>
                    <span className={labelClassName}>Essai avec code affilie</span>
                    <div className="join w-full">
                      <input name="affiliateTrialDays" type="number" min={0} max={365} defaultValue={settings.affiliate_trial_days} className="input input-bordered join-item w-full" required />
                      <span className="join-item flex items-center border border-l-0 border-base-300 bg-base-200 px-3 text-sm text-base-content/60">jours</span>
                    </div>
                  </label>
                  <label className={fieldClassName}>
                    <span className={labelClassName}>Reduction 1er paiement</span>
                    <div className="join w-full">
                      <input name="firstPaymentDiscountRate" type="number" min={0} max={100} step={0.01} defaultValue={settings.first_payment_discount_bp / 100} className="input input-bordered join-item w-full" required />
                      <span className="join-item flex items-center border border-l-0 border-base-300 bg-base-200 px-3 text-sm text-base-content/60">%</span>
                    </div>
                  </label>
                </div>
              </SettingsPanel>

              <SettingsPanel
                description="Regles de calcul des commissions dues aux affilies."
                title="Commissions affilies"
              >
                <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-1 min-[1700px]:grid-cols-2">
                  <CommissionFields
                    fixedAmount={settings.first_payment_fixed_amount}
                    label="Premier paiement"
                    name="firstPayment"
                    rateBp={settings.first_payment_rate_bp}
                    type={settings.first_payment_commission_type}
                  />
                  <CommissionFields
                    fixedAmount={settings.sixth_month_fixed_amount}
                    label="Palier 6 mois"
                    name="sixthMonth"
                    rateBp={settings.sixth_month_rate_bp}
                    type={settings.sixth_month_commission_type}
                  />
                </div>
              </SettingsPanel>
            </div>

            <SettingsPanel
              description="Conditions qui declenchent et planifient le paiement des commissions."
              title="Regles de versement"
            >
              <div className="grid max-w-3xl gap-4 md:grid-cols-2">
                <label className={fieldClassName}>
                  <span className={labelClassName}>Seuil 2e commission</span>
                  <div className="join w-full">
                    <input name="sixthMonthThresholdMonths" type="number" min={1} max={120} defaultValue={settings.sixth_month_threshold_months} className="input input-bordered join-item w-full" required />
                    <span className="join-item flex items-center border border-l-0 border-base-300 bg-base-200 px-3 text-sm text-base-content/60">mois</span>
                  </div>
                </label>
                <label className={fieldClassName}>
                  <span className={labelClassName}>Delai de paiement</span>
                  <div className="join w-full">
                    <input name="payoutDelayDays" type="number" min={0} max={365} defaultValue={settings.payout_delay_days} className="input input-bordered join-item w-full" required />
                    <span className="join-item flex items-center border border-l-0 border-base-300 bg-base-200 px-3 text-sm text-base-content/60">jours</span>
                  </div>
                </label>
              </div>
            </SettingsPanel>

            <div className="flex justify-end border-t border-base-300 pt-5">
              <button type="submit" className="btn btn-primary">Enregistrer les regles</button>
            </div>
          </form>
        </section>

        <section className="rounded-lg border border-base-300 bg-base-100">
          <div className="border-b border-base-300 px-5 py-4"><h2 className="font-display font-bold">Affilies</h2></div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Code</th><th>Nom</th><th>Conversions</th><th>En attente</th><th>Paye</th><th>Statut</th></tr></thead>
              <tbody>
                {affiliates.map((item) => (
                  <tr key={item.id}>
                    <td className="font-semibold">{item.code}</td>
                    <td>{item.display_name}</td>
                    <td>{item.conversions}</td>
                    <td>{item.pending_amount.toLocaleString("fr-FR")} {item.currency ?? ""}</td>
                    <td>{item.paid_amount.toLocaleString("fr-FR")} {item.currency ?? ""}</td>
                    <td>
                      <form action={updateAffiliateStatusAction}>
                        <input type="hidden" name="affiliateId" value={item.id} />
                        <input type="hidden" name="status" value={item.status === "active" ? "suspended" : "active"} />
                        <button
                          type="submit"
                          aria-label={item.status === "active" ? "Suspendre cet affilie" : "Activer cet affilie"}
                          aria-pressed={item.status === "active"}
                          className={`inline-flex min-w-28 items-center gap-2 rounded-full border px-2 py-1 text-sm font-medium transition ${
                            item.status === "active"
                              ? "border-success/25 bg-success/10 text-success"
                              : "border-warning/25 bg-warning/10 text-warning"
                          }`}
                        >
                          <span className={`relative h-5 w-9 rounded-full transition ${item.status === "active" ? "bg-success" : "bg-base-300"}`}>
                            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-base-100 shadow transition ${item.status === "active" ? "left-4" : "left-0.5"}`} />
                          </span>
                          {item.status === "active" ? "Actif" : "Suspendu"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-lg border border-base-300 bg-base-100">
          <div className="border-b border-base-300 px-5 py-4"><h2 className="font-display font-bold">Commissions</h2></div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Affilie</th><th>Atelier</th><th>Jalon</th><th>Montant</th><th>Echeance</th><th>Statut</th><th /></tr></thead>
              <tbody>
                {commissions.map((item) => (
                  <tr key={item.id}>
                    <td><span className="font-semibold">{item.affiliate_code}</span><br /><span className="text-xs text-base-content/55">{item.affiliate_name}</span></td>
                    <td>{item.workshop_name}</td>
                    <td>{item.milestone === "first_payment" ? "Premier paiement" : "6e mois"}</td>
                    <td>{item.amount.toLocaleString("fr-FR")} {item.currency}</td>
                    <td>{new Date(item.due_at).toLocaleDateString("fr-FR")}</td>
                    <td><span className={`badge ${item.status === "pending" ? "badge-warning" : "badge-success"}`}>{item.status === "pending" ? "A payer" : "Payee"}</span></td>
                    <td>
                      {item.status === "pending" ? (
                        <form action={markAffiliateCommissionPaidAction} className="flex items-center gap-2">
                          <input type="hidden" name="commissionId" value={item.id} />
                          <input name="note" placeholder="Reference" className="input input-bordered input-sm w-32" />
                          <button type="submit" className="btn btn-primary btn-sm">Marquer payee</button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

const fieldClassName = "form-control grid min-w-0 max-w-md grid-rows-[2.75rem_auto] content-start";
const labelClassName = "label-text flex min-h-10 items-end pb-1.5 font-medium leading-tight";

function SettingsPanel({ children, description, title }: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="mb-4">
        <h3 className="font-display font-bold">{title}</h3>
        <p className="mt-1 text-sm text-base-content/60">{description}</p>
      </div>
      {children}
    </section>
  );
}

function CommissionFields({ fixedAmount, label, name, rateBp, type }: {
  fixedAmount: number;
  label: string;
  name: "firstPayment" | "sixthMonth";
  rateBp: number;
  type: "percent" | "fixed";
}) {
  return (
    <fieldset className="rounded-lg border border-base-300 bg-base-200/30 p-4">
      <legend className="px-2 text-sm font-semibold">{label}</legend>
      <div className="grid gap-3">
        <label className={fieldClassName}>
          <span className={labelClassName}>Mode</span>
          <select name={`${name}CommissionType`} defaultValue={type} className="select select-bordered w-full">
            <option value="percent">Pourcentage</option>
            <option value="fixed">Montant fixe</option>
          </select>
        </label>
        <label className={fieldClassName}>
          <span className={labelClassName}>Pourcentage</span>
          <div className="join w-full">
            <input name={`${name}Rate`} type="number" min={0} max={100} step={0.01} defaultValue={rateBp / 100} className="input input-bordered join-item w-full" required />
            <span className="join-item flex items-center border border-l-0 border-base-300 bg-base-200 px-3 text-sm text-base-content/60">%</span>
          </div>
        </label>
        <label className={fieldClassName}>
          <span className={labelClassName}>Montant fixe</span>
          <input name={`${name}FixedAmount`} type="number" min={0} defaultValue={fixedAmount} className="input input-bordered w-full" required />
        </label>
      </div>
    </fieldset>
  );
}
