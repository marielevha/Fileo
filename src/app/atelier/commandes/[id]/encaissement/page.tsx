import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { randomUUID } from "node:crypto";
import PageHeader from "@/components/app/PageHeader";
import PaymentForm from "@/components/payments/PaymentForm";
import Icon from "@/components/ui/Icon";
import { requireWorkshop } from "@/lib/auth/guards";
import { localePath } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/request";
import {
  CURRENCIES,
  formatMoney,
  isCurrencyCode,
  toDecimalString,
} from "@/lib/money";
import { getOrder } from "@/lib/repos/orders";

export const metadata: Metadata = {
  title: "Nouvel encaissement",
  robots: { index: false, follow: false },
};

export default async function RecordPaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireWorkshop();
  if (!session.workshop.canViewMoney) notFound();
  const locale = await getLocale();
  const { id } = await params;
  const summary = getOrder(session.workshop.id, id, true);
  if (!summary) notFound();

  const { order, balance } = summary;
  if (!isCurrencyCode(order.currency)) notFound();

  const detailPath = localePath(locale, `/atelier/commandes/${order.id}`);
  const currency = order.currency;

  return (
    <>
      <Link
        href={detailPath}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-base-content/60 transition-colors hover:text-primary"
      >
        <Icon name="arrowRight" className="h-4 w-4 rotate-180" />
        Retour à la commande
      </Link>

      <PageHeader
        title="Enregistrer un encaissement"
        description={`${order.reference} · ${order.client_name}`}
      />

      {order.cancelled_at ? (
        <div className="alert alert-warning">
          Cette commande est annulée. Aucun nouvel encaissement ne peut être enregistré.
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="rounded-2xl border border-base-300 bg-base-100 p-5 sm:p-6">
            <PaymentForm
              orderId={order.id}
              idempotencyKey={randomUUID()}
              currency={currency}
              currencySymbol={CURRENCIES[currency].symbol}
              remainingAmount={balance ? toDecimalString(balance.remainingDue) : "0"}
              today={new Date().toISOString().slice(0, 10)}
            />
          </section>

          <aside className="rounded-2xl border border-base-300 bg-base-100 p-5">
            <h2 className="font-display font-bold">Situation de la commande</h2>
            {balance ? (
              <dl className="mt-4 space-y-3 text-sm">
                <SummaryRow label="Total" value={formatMoney(balance.orderTotal)} />
                <SummaryRow label="Déjà encaissé" value={formatMoney(balance.netCollected)} />
                <div className="flex items-center justify-between border-t border-base-300 pt-3">
                  <dt className="font-semibold">Reste à payer</dt>
                  <dd className="font-display text-lg font-bold text-primary">
                    {formatMoney(balance.remainingDue)}
                  </dd>
                </div>
              </dl>
            ) : null}
          </aside>
        </div>
      )}
    </>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-base-content/60">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
