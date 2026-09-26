import type { Metadata } from "next";
import Icon from "@/components/ui/Icon";
import { requireAffiliate } from "@/lib/auth/guards";
import { getAffiliateOverviewForUser } from "@/lib/repos/affiliates";

export const metadata: Metadata = {
  title: "Espace affilie",
  robots: { index: false, follow: false },
};

const milestoneLabel = {
  first_payment: "Premier paiement",
  sixth_month: "Palier 6 mois",
};

const statusLabel = {
  pending: "A payer",
  paid: "Payee",
  cancelled: "Annulee",
};

export default async function AffiliateDashboardPage() {
  const { user, affiliate } = await requireAffiliate();
  const overview = await getAffiliateOverviewForUser(user.id);
  const conversions = overview.attributions.length;
  const pending = overview.totals.reduce((sum, total) => sum + total.pending, 0);
  const paid = overview.totals.reduce((sum, total) => sum + total.paid, 0);
  const currency = overview.totals[0]?.currency ?? "FCFA";

  return (
    <div className="space-y-8">
      <section className="bg-base-100 border-base-300 rounded-3xl border p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-primary text-sm font-semibold">Programme d&apos;affiliation</p>
            <h1 className="font-display mt-2 text-3xl font-extrabold">Bonjour {affiliate.display_name}</h1>
            <p className="text-base-content/60 mt-2 max-w-2xl">
              {overview.settings.public_description}
            </p>
          </div>
          <div className="bg-primary/10 border-primary/20 rounded-2xl border px-5 py-4">
            <p className="text-base-content/55 text-xs font-semibold uppercase tracking-wide">Votre code</p>
            <p className="text-primary font-display mt-1 text-3xl font-extrabold">{affiliate.code}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard icon="users" label="Ateliers apportes" value={String(conversions)} />
        <StatCard icon="clock" label="Commissions a payer" value={formatMoney(pending, currency)} />
        <StatCard icon="check" label="Commissions payees" value={formatMoney(paid, currency)} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <div className="bg-base-100 border-base-300 rounded-3xl border p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold">Ateliers recommandes</h2>
              <p className="text-base-content/55 mt-1 text-sm">Les inscriptions liees a votre code.</p>
            </div>
            <span className="badge badge-neutral">{conversions}</span>
          </div>

          <div className="mt-5 space-y-3">
            {overview.attributions.length ? overview.attributions.map((attribution) => (
              <div key={attribution.id} className="border-base-300 rounded-2xl border p-4">
                <p className="font-semibold">{attribution.workshop_name ?? "Atelier"}</p>
                <p className="text-base-content/55 mt-1 text-sm">
                  Code {attribution.referral_code} - {formatDate(attribution.attributed_at)}
                </p>
              </div>
            )) : (
              <div className="border-base-300 text-base-content/60 rounded-2xl border border-dashed p-6 text-center text-sm">
                Aucun atelier recommande pour le moment.
              </div>
            )}
          </div>
        </div>

        <div className="bg-base-100 border-base-300 rounded-3xl border p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold">Commissions</h2>
              <p className="text-base-content/55 mt-1 text-sm">Suivi des commissions generees.</p>
            </div>
            <span className="badge badge-neutral">{overview.commissions.length}</span>
          </div>

          <div className="mt-5 overflow-x-auto">
            {overview.commissions.length ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Atelier</th>
                    <th>Palier</th>
                    <th>Montant</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.commissions.map((commission) => (
                    <tr key={commission.id}>
                      <td>{commission.workshop_name ?? "Atelier"}</td>
                      <td>{milestoneLabel[commission.milestone]}</td>
                      <td>{formatMoney(commission.amount, commission.currency)}</td>
                      <td>
                        <span className={`badge ${
                          commission.status === "paid"
                            ? "badge-success"
                            : commission.status === "pending"
                              ? "badge-warning"
                              : "badge-ghost"
                        }`}>
                          {statusLabel[commission.status]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="border-base-300 text-base-content/60 rounded-2xl border border-dashed p-6 text-center text-sm">
                Aucune commission pour le moment.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="bg-base-100 border-base-300 rounded-3xl border p-5 shadow-sm">
      <div className="bg-primary/10 text-primary grid h-11 w-11 place-items-center rounded-2xl">
        <Icon name={icon} className="h-5 w-5" />
      </div>
      <p className="text-base-content/55 mt-4 text-sm">{label}</p>
      <p className="font-display mt-1 text-2xl font-extrabold">{value}</p>
    </div>
  );
}

function formatMoney(amount: number, currency: string) {
  return `${new Intl.NumberFormat("fr-FR").format(amount)} ${currency}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}
