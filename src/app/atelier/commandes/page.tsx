import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/app/PageHeader";
import OrderPageSizeSelect from "@/components/orders/OrderPageSizeSelect";
import Icon from "@/components/ui/Icon";
import { requireWorkshop } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";
import { listOrdersPage, ORDER_STATE_LABELS, type OrderState } from "@/lib/repos/orders";
import { localePath } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/request";

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

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; taille?: string }>;
}) {
  const { workshop } = await requireWorkshop("orders.read");
  const locale = await getLocale();
  const params = await searchParams;
  const requestedPageSize = Number(params.taille);
  const pageSize = [10, 20, 50].includes(requestedPageSize) ? requestedPageSize : 10;
  const result = await listOrdersPage(workshop.id, {
    includeMoney: workshop.canViewMoney,
    page: Number(params.page) || 1,
    pageSize,
  });
  const listPath = localePath(locale, "/atelier/commandes");

  function pageHref(page: number) {
    const next = new URLSearchParams();
    if (pageSize !== 10) next.set("taille", String(pageSize));
    if (page > 1) next.set("page", String(page));
    const query = next.toString();
    return query ? `${listPath}?${query}` : listPath;
  }

  return (
    <>
      <PageHeader
        title="Commandes"
        description="L'état affiché découle de l'avancement des articles."
        action={
          <Link href={localePath(locale, "/atelier/commandes/nouvelle")} className="btn btn-primary gap-2">
            <Icon name="arrowRight" className="h-4 w-4" />
            Nouvelle commande
          </Link>
        }
      />

      {result.total === 0 ? (
        <div className="bg-base-100 border-base-300 rounded-2xl border p-12 text-center">
          <p className="font-medium">Aucune commande enregistrée.</p>
          <p className="text-base-content/55 mt-1.5 text-sm">
            Créez une commande depuis une fiche client ou directement ici.
          </p>
          <Link href={localePath(locale, "/atelier/commandes/nouvelle")} className="btn btn-primary mt-6">
            Nouvelle commande
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-4 flex justify-end">
            <OrderPageSizeSelect pageSize={pageSize} />
          </div>

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
                  <th className="text-right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {result.items.map(({ order, state, balance, isLate }) => (
                  <tr key={order.id} className="hover:bg-base-200">
                    <td>
                      <Link
                        href={localePath(locale, `/atelier/commandes/${order.id}`)}
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
                    <td className="text-right">
                      <Link
                        href={localePath(locale, `/atelier/commandes/${order.id}`)}
                        aria-label={`Voir le détail de la commande ${order.reference}`}
                        className="btn btn-ghost btn-sm gap-1.5"
                      >
                        Voir
                        <Icon name="arrowRight" className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 text-sm">
            <p className="text-base-content/55">
              {result.total} commande{result.total > 1 ? "s" : ""} - page {result.page} sur {result.pageCount}
            </p>
            {result.pageCount > 1 ? (
              <nav aria-label="Pagination des commandes" className="join">
                <Link
                  href={pageHref(result.page - 1)}
                  aria-disabled={result.page === 1}
                  className={`btn btn-sm join-item ${result.page === 1 ? "btn-disabled" : ""}`}
                >
                  Précédent
                </Link>
                {Array.from({ length: result.pageCount }, (_, index) => index + 1)
                  .filter((page) => Math.abs(page - result.page) <= 2 || page === 1 || page === result.pageCount)
                  .map((page) => (
                    <Link
                      key={page}
                      href={pageHref(page)}
                      aria-current={page === result.page ? "page" : undefined}
                      className={`btn btn-sm join-item ${page === result.page ? "btn-active" : ""}`}
                    >
                      {page}
                    </Link>
                  ))}
                <Link
                  href={pageHref(result.page + 1)}
                  aria-disabled={result.page === result.pageCount}
                  className={`btn btn-sm join-item ${result.page === result.pageCount ? "btn-disabled" : ""}`}
                >
                  Suivant
                </Link>
              </nav>
            ) : null}
          </div>
        </>
      )}

      {!workshop.canViewMoney ? (
        <p className="text-base-content/45 mt-4 text-xs">
          Les montants ne vous sont pas transmis : votre compte n&apos;a pas le droit financier.
        </p>
      ) : null}
    </>
  );
}
