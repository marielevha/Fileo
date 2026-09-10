import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/app/PageHeader";
import Icon from "@/components/ui/Icon";
import { requireWorkshop } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";
import { listOrders, ORDER_STATE_LABELS, type OrderState } from "@/lib/repos/orders";

export const metadata: Metadata = {
  title: "Commandes",
  robots: { index: false, follow: false },
};

const STATE_TONE: Record<OrderState, string> = {
  nouvelle: "badge-ghost",
  en_cours: "badge-info",
  prete: "badge-success",
  partiellement_remise: "badge-warning",
  remise: "badge-ghost",
  annulee: "badge-error",
};

export default async function OrdersPage() {
  const { workshop } = await requireWorkshop("orders.read");

  const orders = listOrders(workshop.id, { includeMoney: workshop.canViewMoney });

  return (
    <>
      <PageHeader
        title="Commandes"
        description="L'état affiché découle de l'avancement des articles."
        action={
          <Link href="/atelier/commandes/nouvelle" className="btn btn-primary gap-2">
            <Icon name="arrowRight" className="h-4 w-4" />
            Nouvelle commande
          </Link>
        }
      />

      {orders.length === 0 ? (
        <div className="bg-base-100 border-base-300 rounded-2xl border p-12 text-center">
          <p className="font-medium">Aucune commande enregistrée.</p>
          <p className="text-base-content/55 mt-1.5 text-sm">
            Créez une commande depuis une fiche client ou directement ici.
          </p>
          <Link href="/atelier/commandes/nouvelle" className="btn btn-primary mt-6">
            Nouvelle commande
          </Link>
        </div>
      ) : (
        <div className="bg-base-100 border-base-300 overflow-hidden rounded-2xl border">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Client</th>
                  <th>État</th>
                  <th>Échéance</th>
                  {workshop.canViewMoney ? <th className="text-right">Reste à payer</th> : null}
                </tr>
              </thead>
              <tbody>
                {orders.map(({ order, state, balance, isLate }) => (
                  <tr key={order.id} className="hover:bg-base-200">
                    <td>
                      <Link
                        href={`/atelier/commandes/${order.id}`}
                        className="hover:text-primary font-medium transition-colors"
                      >
                        {order.reference}
                      </Link>
                    </td>
                    <td className="text-base-content/70">{order.client_name}</td>
                    <td>
                      <span className={`badge badge-sm ${STATE_TONE[state]}`}>
                        {ORDER_STATE_LABELS[state]}
                      </span>
                      {/* Late is an indicator, shown alongside progress — it never replaces it. */}
                      {isLate ? (
                        <span className="badge badge-error badge-sm ml-1.5">En retard</span>
                      ) : null}
                    </td>
                    <td className="text-base-content/60 text-sm">
                      {order.promised_date
                        ? new Date(`${order.promised_date}T00:00:00`).toLocaleDateString("fr-FR")
                        : "—"}
                    </td>
                    {workshop.canViewMoney ? (
                      <td className="text-right font-medium">
                        {balance ? formatMoney(balance.remainingDue) : "—"}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!workshop.canViewMoney ? (
        <p className="text-base-content/45 mt-4 text-xs">
          Les montants ne vous sont pas transmis : votre compte n&apos;a pas le droit financier.
        </p>
      ) : null}
    </>
  );
}
