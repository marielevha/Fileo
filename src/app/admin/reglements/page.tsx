import type { Metadata } from "next";
import PageHeader from "@/components/app/PageHeader";
import ReviewButtons from "./ReviewButtons";
import { requireAdmin } from "@/lib/auth/guards";
import { formatMoney, money, type CurrencyCode } from "@/lib/money";
import { listPlatformPayments } from "@/lib/repos/admin";

export const metadata: Metadata = {
  title: "Règlements",
  robots: { index: false, follow: false },
};

const CHANNEL_LABELS: Record<string, string> = {
  mobile_money: "Mobile money",
  cash: "Espèces",
  transfer: "Virement",
};

const STATUS_TONE: Record<string, string> = {
  declared: "badge-warning",
  validated: "badge-success",
  rejected: "badge-error",
};

const STATUS_LABELS: Record<string, string> = {
  declared: "À valider",
  validated: "Validé",
  rejected: "Rejeté",
};

/**
 * §11.3 (P0): an external payment is activated only after a human validates
 * the reconciliation. A screenshot alone never activates a subscription.
 */
export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string }>;
}) {
  await requireAdmin("admin.payments.validate");

  const { statut } = await searchParams;
  const payments = await listPlatformPayments(statut);

  return (
    <>
      <PageHeader
        title="Règlements d'abonnement"
        description="Validation manuelle après rapprochement réel. Une capture d'écran ne suffit pas."
      />

      <nav className="mb-6 flex flex-wrap gap-2">
        {[
          { label: "À valider", value: "declared" },
          { label: "Validés", value: "validated" },
          { label: "Rejetés", value: "rejected" },
          { label: "Tous", value: undefined },
        ].map((filter) => (
          <a
            key={filter.label}
            href={filter.value ? `?statut=${filter.value}` : "?"}
            className={`btn btn-sm ${statut === filter.value ? "btn-primary" : "btn-outline"}`}
          >
            {filter.label}
          </a>
        ))}
      </nav>

      {payments.length === 0 ? (
        <p className="bg-base-100 border-base-300 rounded-2xl border p-12 text-center text-sm">
          Aucun règlement dans cette catégorie.
        </p>
      ) : (
        <ul className="space-y-4">
          {payments.map((payment) => (
            <li
              key={payment.id}
              className="bg-base-100 border-base-300 rounded-2xl border p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-display font-bold">{payment.workshop_name}</p>
                  <p className="text-base-content/55 mt-1 text-sm">
                    {CHANNEL_LABELS[payment.channel] ?? payment.channel}
                    {payment.external_reference ? ` · réf. ${payment.external_reference}` : ""}
                    {" · déclaré le "}
                    {new Date(payment.declared_at).toLocaleDateString("fr-FR")}
                  </p>
                  <p className="text-base-content/60 mt-2 text-sm">
                    Offre :{" "}
                    <span className="font-medium text-base-content">
                      {payment.plan_label ?? "Offre historique"}
                    </span>
                    {payment.plan_period_months ? ` · ${payment.plan_period_months} mois` : ""}
                  </p>
                  {payment.status === "declared" && payment.projected_period_end ? (
                    <p className="alert alert-info mt-3 py-3 text-sm">
                      Validation = abonnement prolongé jusqu&apos;au{" "}
                      {new Date(`${payment.projected_period_end}T00:00:00`).toLocaleDateString("fr-FR")}.
                    </p>
                  ) : null}
                  {payment.review_note ? (
                    <p className="text-base-content/60 mt-2 text-sm italic">
                      Note : {payment.review_note}
                    </p>
                  ) : null}
                </div>

                <div className="text-right">
                  <p className="font-display text-xl font-extrabold">
                    {formatMoney(money(payment.amount, payment.currency as CurrencyCode))}
                  </p>
                  <span className={`badge badge-sm mt-1.5 ${STATUS_TONE[payment.status]}`}>
                    {STATUS_LABELS[payment.status] ?? payment.status}
                  </span>
                </div>
              </div>

              <ReviewButtons paymentId={payment.id} canReview={payment.status === "declared"} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
