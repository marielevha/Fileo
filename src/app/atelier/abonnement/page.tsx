import type { Metadata } from "next";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import PageHeader from "@/components/app/PageHeader";
import DeclarePaymentForm, { type PaymentPlanOption } from "@/components/subscriptions/DeclarePaymentForm";
import Icon from "@/components/ui/Icon";
import { requireWorkshop } from "@/lib/auth/guards";
import { localePath } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/request";
import { formatMoney, toDecimalString, type CurrencyCode } from "@/lib/money";
import {
  getSubscriptionOverview,
  PAYMENT_CHANNEL_LABELS,
  type PlatformPaymentStatus,
  type PlanWithLimits,
  type SubscriptionOverview,
  type SubscriptionStatus,
} from "@/lib/repos/subscriptions";

export const metadata: Metadata = {
  title: "Abonnement",
  robots: { index: false, follow: false },
};

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  trial: "Essai",
  active: "Actif",
  renewal_due: "À renouveler",
  suspended: "Suspendu",
  cancelled: "Annulé",
};

const PAYMENT_STATUS_LABELS: Record<PlatformPaymentStatus, string> = {
  declared: "À valider",
  validated: "Validé",
  rejected: "Rejeté",
};

const PAYMENT_STATUS_TONE: Record<PlatformPaymentStatus, string> = {
  declared: "badge-warning",
  validated: "badge-success",
  rejected: "badge-error",
};

export default async function SubscriptionPage() {
  const { workshop } = await requireWorkshop("subscription.manage");
  const locale = await getLocale();
  const currency = workshop.currency as CurrencyCode;
  const overview = await getSubscriptionOverview({
    workshopId: workshop.id,
    countryCode: workshop.countryCode,
    currency,
  });
  const today = todayIso();

  return (
    <>
      <PageHeader
        title="Abonnement"
        description="Choisissez une offre, déclarez un paiement manuel et suivez la validation Filéo."
        action={
          <Link href={localePath(locale, "/atelier/equipe")} className="btn btn-primary gap-2">
            Gérer l&apos;équipe
            <Icon name="arrowRight" className="h-4 w-4" />
          </Link>
        }
      />

      <SubscriptionSummary overview={overview} />
      <PaymentInstructions />
      <PlanPaymentSection
        plans={overview.availablePlans}
        currentPlanId={overview.currentPlan?.id ?? null}
        today={today}
      />
      <PaymentsHistory payments={overview.payments} currency={currency} />
    </>
  );
}

function SubscriptionSummary({ overview }: { overview: SubscriptionOverview }) {
  const { subscription, currentPlan, usage } = overview;
  const tiles = [
    {
      label: "Offre actuelle",
      value: currentPlan?.label ?? "Non définie",
      accent: "accent-1",
    },
    {
      label: "Statut",
      value: subscription ? STATUS_LABELS[subscription.status] ?? subscription.status : "Aucun",
      accent: "accent-2",
    },
    {
      label: "Fin de période",
      value: subscription?.current_period_end ? formatDate(subscription.current_period_end) : "Non définie",
      accent: "accent-2",
    },
    {
      label: usage.memberLimit === null ? "Membres actifs" : `Membres actifs / ${usage.memberLimit}`,
      value: usage.activeMembers,
      accent: "accent-3",
    },
  ];

  return (
    <section className="mb-6">
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <li key={tile.label} className={tile.accent}>
            <div className="rounded-2xl border border-base-300 bg-base-100 p-5">
              <p className="font-display text-2xl font-extrabold text-[color:var(--accent)]">
                {tile.value}
              </p>
              <p className="mt-1 text-sm text-base-content/60">{tile.label}</p>
            </div>
          </li>
        ))}
      </ul>

      {usage.memberLimitExceeded ? (
        <p className="alert alert-warning mt-4 py-3 text-sm">
          <Icon name="shield" className="h-5 w-5" />
          L&apos;atelier dépasse la limite de membres de son offre actuelle.
        </p>
      ) : null}
    </section>
  );
}

function PaymentInstructions() {
  return (
    <section className="mb-6 rounded-2xl border border-base-300 bg-base-100 p-5">
      <h2 className="font-display font-bold">Paiement manuel</h2>
      <div className="mt-3 grid gap-3 text-sm text-base-content/70 md:grid-cols-2 xl:grid-cols-4">
        <p className="rounded-lg border border-base-300 bg-base-200/50 p-3">
          Payez depuis votre téléphone ou par virement avec le montant exact de l&apos;offre choisie.
        </p>
        <p className="rounded-lg border border-base-300 bg-base-200/50 p-3">
          Renseignez la référence de transaction dans Filéo après paiement.
        </p>
        <p className="rounded-lg border border-base-300 bg-base-200/50 p-3">
          L&apos;abonnement est activé ou prolongé après validation manuelle par l&apos;équipe Filéo.
        </p>
        <p className="rounded-lg border border-base-300 bg-base-200/50 p-3">
          Chaque paiement validé prolonge l&apos;abonnement d&apos;une période. Un seul paiement en attente est autorisé par offre.
        </p>
      </div>
    </section>
  );
}

function PlanPaymentSection({
  plans,
  currentPlanId,
  today,
}: {
  plans: PlanWithLimits[];
  currentPlanId: string | null;
  today: string;
}) {
  const paymentPlans = plans.map((plan): PaymentPlanOption => ({
    id: plan.id,
    label: plan.label,
    amount: toDecimalString(plan.price),
    priceLabel: formatMoney(plan.price),
    periodLabel: `${plan.period_months} mois`,
    membersLabel: `${plan.limits.members ?? "Illimité"} membres`,
    currency: plan.currency,
    current: plan.id === currentPlanId,
  }));
  const currency = paymentPlans[0]?.currency ?? "XAF";

  return (
    <section className="mb-7 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="overflow-hidden rounded-2xl border border-base-300 bg-base-100">
        <div className="border-b border-base-300 px-5 py-4">
          <h2 className="font-display text-xl font-bold">Offres disponibles</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Offre</th>
                <th>Période</th>
                <th>Membres</th>
                <th className="text-right">Prix</th>
                <th className="text-right">Statut</th>
              </tr>
            </thead>
            <tbody>
              {paymentPlans.map((plan) => (
                <tr key={plan.id} className="align-middle hover:bg-base-200/70">
                  <td className="py-4">
                    <p className="font-display text-base font-bold">{plan.label}</p>
                  </td>
                  <td className="py-4 text-sm text-base-content/65">{plan.periodLabel}</td>
                  <td className="py-4 text-sm text-base-content/65">{plan.membersLabel}</td>
                  <td className="py-4 text-right font-display text-xl font-extrabold text-primary">
                    {plan.priceLabel}
                  </td>
                  <td className="py-4 text-right">
                    {plan.current ? (
                      <span className="badge badge-success badge-sm">Actuelle</span>
                    ) : (
                      <span className="text-sm text-base-content/45">Disponible</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-base-300 bg-base-100 p-5">
        <h2 className="font-display text-xl font-bold">Déclarer un paiement</h2>
        <p className="mt-1 text-sm text-base-content/60">
          Sélectionnez l&apos;offre payée, puis renseignez les informations de transaction.
        </p>
        <div className="mt-5">
          <DeclarePaymentForm
            plans={paymentPlans}
            currency={currency}
            today={today}
            idempotencyKey={randomUUID()}
          />
        </div>
      </div>
    </section>
  );
}

function PaymentsHistory({
  payments,
  currency,
}: {
  payments: SubscriptionOverview["payments"];
  currency: CurrencyCode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-base-300 bg-base-100">
      <div className="border-b border-base-300 px-5 py-4">
        <h2 className="font-display font-bold">Règlements déclarés</h2>
      </div>

      {payments.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-base-content/55">
          Aucun règlement déclaré pour le moment.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table table-fixed">
            <colgroup>
              <col className="w-[28%]" />
              <col className="w-[18%]" />
              <col className="w-[18%]" />
              <col className="w-[18%]" />
              <col className="w-[18%]" />
            </colgroup>
            <thead>
              <tr>
                <th>Offre</th>
                <th>Moyen</th>
                <th>Référence</th>
                <th>Déclaré le</th>
                <th className="text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} className="align-middle hover:bg-base-200/70">
                  <td className="py-4">
                    <span className="font-medium">{payment.plan_label ?? "Offre historique"}</span>
                    <span className={`badge badge-sm mt-1.5 block w-fit ${PAYMENT_STATUS_TONE[payment.status]}`}>
                      {PAYMENT_STATUS_LABELS[payment.status]}
                    </span>
                  </td>
                  <td className="py-4 text-sm text-base-content/70">
                    {PAYMENT_CHANNEL_LABELS[payment.channel as keyof typeof PAYMENT_CHANNEL_LABELS] ?? payment.channel}
                  </td>
                  <td className="py-4 text-sm text-base-content/70">
                    {payment.external_reference ?? "Sans référence"}
                  </td>
                  <td className="py-4 text-sm text-base-content/70">{formatDate(payment.declared_at)}</td>
                  <td className="py-4 text-right font-semibold">
                    {formatMoney({ amount: payment.amount, currency })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}
