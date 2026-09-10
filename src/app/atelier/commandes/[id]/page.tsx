import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/app/PageHeader";
import Icon from "@/components/ui/Icon";
import { requireWorkshop } from "@/lib/auth/guards";
import { formatMoney, money, multiply, type CurrencyCode } from "@/lib/money";
import { getOrder, ITEM_STATUS_LABELS, ORDER_STATE_LABELS, type ItemStatus } from "@/lib/repos/orders";
import { listMovements, METHOD_LABELS, type MovementMethod } from "@/lib/repos/payments";
import { localePath } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/request";

export const metadata: Metadata = {
  title: "Commande",
  robots: { index: false, follow: false },
};

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ encaissement?: string }>;
}) {
  const { workshop } = await requireWorkshop("orders.read");
  const locale = await getLocale();
  const { id } = await params;
  const query = await searchParams;

  const summary = getOrder(workshop.id, id, workshop.canViewMoney);
  if (!summary) notFound();

  const { order, items, state, balance, isLate } = summary;
  const currency = order.currency as CurrencyCode;
  const movements = workshop.canViewMoney ? listMovements(workshop.id, order.id) : [];

  return (
    <>
      <Link
        href={localePath(locale, "/atelier/commandes")}
        className="text-base-content/60 hover:text-primary mb-4 inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <Icon name="arrowRight" className="h-4 w-4 rotate-180" />
        Toutes les commandes
      </Link>

      <PageHeader
        title={order.reference}
        description={`${order.client_name} · créée le ${new Date(order.created_at).toLocaleDateString("fr-FR")}`}
        action={
          <div className="flex flex-wrap gap-2">
            <span className="badge badge-lg">{ORDER_STATE_LABELS[state]}</span>
            {isLate ? <span className="badge badge-error badge-lg">En retard</span> : null}
          </div>
        }
      />

      {query.encaissement === "ok" ? (
        <p className="alert alert-success mb-6 py-3 text-sm">
          <Icon name="check" className="h-5 w-5" />
          Encaissement enregistré avec succès.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="bg-base-100 border-base-300 rounded-2xl border">
            <h2 className="border-base-300 font-display border-b px-6 py-4 font-bold">
              Articles ({items.length})
            </h2>

            <ul className="divide-base-300 divide-y">
              {items.map((item) => (
                <li key={item.id} className="px-6 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{item.description}</p>
                      <p className="text-base-content/55 mt-0.5 text-sm">
                        {item.category} · quantité {item.quantity}
                        {item.due_date
                          ? ` · échéance ${new Date(`${item.due_date}T00:00:00`).toLocaleDateString("fr-FR")}`
                          : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`badge badge-sm ${item.status === "annule" ? "badge-error" : "badge-ghost"}`}
                      >
                        {ITEM_STATUS_LABELS[item.status as ItemStatus] ?? item.status}
                      </span>

                      {workshop.canViewMoney ? (
                        <span className="font-medium">
                          {formatMoney(
                            multiply(money(item.unit_price_amount, currency), item.quantity),
                          )}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {order.instructions ? (
            <section className="bg-base-100 border-base-300 rounded-2xl border p-6">
              <h2 className="font-display font-bold">Instructions</h2>
              <p className="text-base-content/70 mt-2 text-sm leading-relaxed whitespace-pre-line">
                {order.instructions}
              </p>
            </section>
          ) : null}

          {workshop.canViewMoney ? (
            <section className="bg-base-100 border-base-300 rounded-2xl border">
              <div className="border-base-300 flex items-center justify-between border-b px-6 py-4">
                <h2 className="font-display font-bold">Encaissements</h2>
                <Link
                  href={localePath(locale, `/atelier/commandes/${order.id}/encaissement`)}
                  className="btn btn-primary btn-sm"
                >
                  Enregistrer un encaissement
                </Link>
              </div>

              {movements.length === 0 ? (
                <p className="text-base-content/55 px-6 py-10 text-center text-sm">
                  Aucun encaissement enregistré sur cette commande.
                </p>
              ) : (
                <ul className="divide-base-300 divide-y">
                  {movements.map((movement) => (
                    <li key={movement.id} className="flex items-center gap-4 px-6 py-3.5">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">
                          {movement.kind === "payment"
                            ? "Encaissement"
                            : movement.kind === "refund"
                              ? "Remboursement"
                              : "Correction"}
                          {" · "}
                          {METHOD_LABELS[movement.method as MovementMethod] ?? movement.method}
                        </span>
                        <span className="text-base-content/55 block text-xs">
                          {new Date(`${movement.effective_date}T00:00:00`).toLocaleDateString("fr-FR")}
                          {movement.reference ? ` · réf. ${movement.reference}` : ""}
                        </span>
                      </span>

                      {/* Offline entries are never presented as server-confirmed (§8.7). */}
                      {movement.status === "pending" ? (
                        <span className="badge badge-warning badge-sm">En attente</span>
                      ) : null}
                      {movement.status === "voided" ? (
                        <span className="badge badge-ghost badge-sm">Annulé</span>
                      ) : null}

                      <span
                        className={`shrink-0 font-medium ${
                          movement.kind === "payment" ? "text-success" : "text-error"
                        } ${movement.status === "voided" ? "line-through opacity-50" : ""}`}
                      >
                        {movement.kind === "payment" ? "+" : "−"}
                        {formatMoney(money(movement.amount, currency))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </div>

        {/* Balance panel — the §8.7 formulas, shown line by line. */}
        <aside className="space-y-6">
          {balance ? (
            <section className="bg-base-100 border-base-300 rounded-2xl border p-6">
              <h2 className="font-display font-bold">Solde</h2>

              <dl className="mt-4 space-y-2.5 text-sm">
                <Row label="Total commande" value={formatMoney(balance.orderTotal)} />
                {balance.appliedDiscount.amount > 0 ? (
                  <Row
                    label="Réduction appliquée"
                    value={`− ${formatMoney(balance.appliedDiscount)}`}
                  />
                ) : null}
                <Row label="Encaissement net" value={formatMoney(balance.netCollected)} />

                <div className="border-base-300 flex items-center justify-between border-t pt-3">
                  <dt className="font-semibold">Reste à payer</dt>
                  <dd className="font-display text-primary text-lg font-bold">
                    {formatMoney(balance.remainingDue)}
                  </dd>
                </div>
              </dl>

              {/* §8.7: an overpayment is kept and flagged, never absorbed. */}
              {balance.overpayment.amount > 0 ? (
                <p className="alert alert-warning mt-4 text-sm">
                  Trop-perçu de {formatMoney(balance.overpayment)} à traiter.
                </p>
              ) : null}
            </section>
          ) : (
            <section className="bg-base-100 border-base-300 rounded-2xl border p-6">
              <h2 className="font-display font-bold">Solde</h2>
              <p className="text-base-content/55 mt-2 text-sm">
                Les montants ne vous sont pas transmis : votre compte n&apos;a pas le droit
                financier sur cet atelier.
              </p>
            </section>
          )}

          <section className="bg-base-100 border-base-300 rounded-2xl border p-6">
            <h2 className="font-display font-bold">Client</h2>
            <Link
              href={localePath(locale, `/atelier/clients/${order.client_id}`)}
              className="link link-primary mt-2 block text-sm"
            >
              {order.client_name}
            </Link>

            {order.promised_date ? (
              <p className="text-base-content/60 mt-4 text-sm">
                Date promise :{" "}
                <span className="text-base-content font-medium">
                  {new Date(`${order.promised_date}T00:00:00`).toLocaleDateString("fr-FR")}
                </span>
              </p>
            ) : null}
          </section>
        </aside>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-base-content/60">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
