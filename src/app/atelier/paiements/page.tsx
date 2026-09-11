import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/app/PageHeader";
import PaymentControls from "@/components/payments/PaymentControls";
import Icon from "@/components/ui/Icon";
import { requireWorkshop } from "@/lib/auth/guards";
import { getLocale } from "@/lib/i18n/request";
import { localePath } from "@/lib/i18n/config";
import { formatMoney, type CurrencyCode } from "@/lib/money";
import {
  listPaymentOrders,
  type PaymentOrderFilter,
  type PaymentOrderRow,
} from "@/lib/repos/payments";
import { ORDER_STATE_LABELS, type OrderState } from "@/lib/repos/orders";

export const metadata: Metadata = {
  title: "Paiements",
  robots: { index: false, follow: false },
};

const FILTERS: PaymentOrderFilter[] = [
  "all",
  "a_encaisser",
  "acompte",
  "payes",
  "sans_paiement",
  "retard",
  "trop_percu",
];

const PAYMENT_TONE: Record<string, string> = {
  due: "badge-warning",
  deposit: "badge-info",
  paid: "badge-success",
  none: "badge-ghost",
  overdue: "badge-error",
  overpaid: "badge-secondary",
};

const STATE_TONE: Record<OrderState, string> = {
  nouvelle: "badge-ghost",
  en_cours: "badge-info",
  prete: "badge-success",
  partiellement_remise: "badge-warning",
  remise: "badge-ghost",
  annulee: "badge-error",
};

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filtre?: string; page?: string }>;
}) {
  const { workshop } = await requireWorkshop("money.read");
  const locale = await getLocale();
  const params = await searchParams;
  const filter: PaymentOrderFilter = FILTERS.includes(params.filtre as PaymentOrderFilter)
    ? params.filtre as PaymentOrderFilter
    : "all";
  const search = params.q?.trim() ?? "";
  const page = parsePositiveInt(params.page) ?? 1;
  const listPath = localePath(locale, "/atelier/paiements");
  const baseQuery = new URLSearchParams();
  if (search) baseQuery.set("q", search);
  if (filter !== "all") baseQuery.set("filtre", filter);

  const result = await listPaymentOrders(workshop.id, {
    search,
    filter,
    page,
    pageSize: 10,
    today: todayIso(),
    currency: workshop.currency as CurrencyCode,
  });

  const statTiles = [
    {
      label: "Encaissé aujourd'hui",
      value: formatMoney(result.stats.todayCollected),
      href: listPath,
      accent: "accent-2",
    },
    {
      label: "Reste à encaisser",
      value: formatMoney(result.stats.totalRemainingDue),
      href: `${listPath}?filtre=a_encaisser`,
      accent: "accent-1",
    },
    {
      label: "Commandes en retard",
      value: result.stats.overdueOrders,
      href: `${listPath}?filtre=retard`,
      accent: "accent-3",
    },
    {
      label: "Trop-perçus à traiter",
      value: result.stats.overpaidOrders,
      href: `${listPath}?filtre=trop_percu`,
      accent: "accent-2",
    },
  ];

  return (
    <>
      <PageHeader
        title="Paiements"
        description="Suivez les acomptes, les soldes et les encaissements de l'atelier."
        action={
          <Link href={localePath(locale, "/atelier/commandes")} className="btn btn-primary gap-2">
            Voir les commandes
            <Icon name="arrowRight" className="h-4 w-4" />
          </Link>
        }
      />

      <ul className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statTiles.map((tile) => (
          <li key={tile.label} className={tile.accent}>
            <Link
              href={tile.href}
              className="card-lift block rounded-2xl border border-base-300 bg-base-100 p-5"
            >
              <p className="font-display text-3xl font-extrabold text-[color:var(--accent)]">
                {tile.value}
              </p>
              <p className="mt-1 text-sm text-base-content/60">{tile.label}</p>
            </Link>
          </li>
        ))}
      </ul>

      <PaymentControls search={search} filter={filter} />

      {result.total === 0 ? (
        <div className="rounded-2xl border border-base-300 bg-base-100 px-6 py-12 text-center">
          <p className="font-medium">Aucune commande ne correspond à ces filtres.</p>
          <Link href={listPath} className="btn btn-ghost btn-sm mt-4">Réinitialiser les paiements</Link>
        </div>
      ) : (
        <PaymentTable
          items={result.items}
          locale={locale}
          pagination={{
            total: result.total,
            page: result.page,
            pageCount: result.pageCount,
            href: (nextPage) => pageHref(listPath, baseQuery, nextPage),
          }}
        />
      )}
    </>
  );
}

function PaymentTable({
  items,
  locale,
  pagination,
}: {
  items: PaymentOrderRow[];
  locale: "fr" | "en" | "lg";
  pagination: {
    total: number;
    page: number;
    pageCount: number;
    href: (page: number) => string;
  };
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-base-300 bg-base-100">
      <div className="overflow-x-auto">
        <table className="table table-fixed">
          <colgroup>
            <col className="w-[27%]" />
            <col className="w-[21%]" />
            <col className="w-[18%]" />
            <col className="w-[17%]" />
            <col className="w-[17%]" />
          </colgroup>
          <thead>
            <tr>
              <th>Commande</th>
              <th>Situation</th>
              <th>Encaissements</th>
              <th className="text-right">Reste à payer</th>
              <th className="text-right"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.order.id} className="align-middle hover:bg-base-200/70">
                <td className="min-w-64 py-5">
                  <Link
                    href={localePath(locale, `/atelier/commandes/${item.order.id}`)}
                    className="line-clamp-2 font-medium leading-snug transition-colors hover:text-primary"
                  >
                    {item.order.reference}
                  </Link>
                  <span className="mt-1 block text-sm leading-snug text-base-content/55">
                    {item.order.client_name}
                  </span>
                  {item.order.promised_date ? (
                    <span className={item.isLate ? "mt-2 block text-sm font-semibold text-error" : "mt-2 block text-sm text-base-content/55"}>
                      Échéance · {formatDate(item.order.promised_date)}
                    </span>
                  ) : null}
                </td>
                <td className="min-w-56 py-5">
                  <div className="flex flex-wrap gap-1.5">
                    <span className={`badge badge-sm min-w-24 justify-center whitespace-nowrap ${STATE_TONE[item.state]}`}>
                      {ORDER_STATE_LABELS[item.state]}
                    </span>
                    <PaymentStatusBadge item={item} />
                  </div>
                  <dl className="mt-3 space-y-1 text-sm">
                    <Row label="Total" value={formatMoney(item.orderTotal)} />
                    <Row label="Encaissé" value={formatMoney(item.netCollected)} />
                  </dl>
                </td>
                <td className="py-5 text-sm leading-snug">
                  {item.movementCount > 0 ? (
                    <>
                      <span className="font-medium">{item.movementCount} mouvement{item.movementCount > 1 ? "s" : ""}</span>
                      <span className="mt-1 block text-base-content/55">
                        Dernier · {item.lastPaymentDate ? formatDate(item.lastPaymentDate) : "non daté"}
                      </span>
                    </>
                  ) : (
                    <span className="text-base-content/45">Aucun encaissement</span>
                  )}
                </td>
                <td className="py-5 text-right">
                  <span className={item.remainingDue.amount > 0 ? "font-display text-lg font-bold text-primary" : "font-semibold text-success"}>
                    {formatMoney(item.remainingDue)}
                  </span>
                  {item.overpayment.amount > 0 ? (
                    <span className="mt-1 block text-xs font-semibold text-secondary">
                      Trop-perçu · {formatMoney(item.overpayment)}
                    </span>
                  ) : null}
                </td>
                <td className="py-5 text-right">
                  <div className="flex justify-end gap-2">
                    {item.remainingDue.amount > 0 ? (
                      <Link
                        href={localePath(locale, `/atelier/commandes/${item.order.id}/encaissement`)}
                        className="btn btn-primary btn-sm"
                      >
                        Encaisser
                      </Link>
                    ) : null}
                    <Link
                      href={localePath(locale, `/atelier/commandes/${item.order.id}`)}
                      aria-label={`Voir la commande ${item.order.reference}`}
                      className="btn btn-ghost btn-sm btn-square"
                    >
                      <Icon name="arrowRight" className="h-4 w-4" />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-base-300 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-base-content/55">
          {pagination.total} commande{pagination.total > 1 ? "s" : ""} - page {pagination.page} sur {pagination.pageCount}
        </p>
        <nav className="join" aria-label="Pagination des paiements">
          <Link
            href={pagination.href(Math.max(1, pagination.page - 1))}
            aria-disabled={pagination.page === 1}
            className={`btn btn-sm join-item ${pagination.page === 1 ? "btn-disabled" : "btn-ghost"}`}
          >
            Précédent
          </Link>
          {visiblePages(pagination.page, pagination.pageCount).map((page) => (
            <Link
              key={page}
              href={pagination.href(page)}
              aria-current={page === pagination.page ? "page" : undefined}
              className={`btn btn-sm join-item ${page === pagination.page ? "btn-active" : "btn-ghost"}`}
            >
              {page}
            </Link>
          ))}
          <Link
            href={pagination.href(Math.min(pagination.pageCount, pagination.page + 1))}
            aria-disabled={pagination.page === pagination.pageCount}
            className={`btn btn-sm join-item ${pagination.page === pagination.pageCount ? "btn-disabled" : "btn-ghost"}`}
          >
            Suivant
          </Link>
        </nav>
      </div>
    </div>
  );
}

function PaymentStatusBadge({ item }: { item: PaymentOrderRow }) {
  const status = getPaymentStatus(item);
  return (
    <span className={`badge badge-sm min-w-24 justify-center whitespace-nowrap ${PAYMENT_TONE[status.tone]}`}>
      {status.label}
    </span>
  );
}

function getPaymentStatus(item: PaymentOrderRow) {
  if (item.overpayment.amount > 0) return { label: "Trop-perçu", tone: "overpaid" };
  if (item.isLate) return { label: "En retard", tone: "overdue" };
  if (item.remainingDue.amount === 0) return { label: "Payé", tone: "paid" };
  if (item.netCollected.amount > 0) return { label: "Acompte reçu", tone: "deposit" };
  return { label: "Solde dû", tone: "due" };
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-base-content/55">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function parsePositiveInt(value?: string): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function pageHref(pathname: string, baseParams: URLSearchParams, page: number): string {
  const params = new URLSearchParams(baseParams);
  if (page > 1) params.set("page", String(page));
  else params.delete("page");
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function visiblePages(current: number, total: number): number[] {
  const start = Math.max(1, Math.min(current - 1, total - 2));
  const end = Math.min(total, start + 2);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
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
