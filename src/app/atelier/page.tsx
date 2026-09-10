import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/app/PageHeader";
import Icon from "@/components/ui/Icon";
import { requireWorkshop } from "@/lib/auth/guards";
import { formatMoney, type CurrencyCode } from "@/lib/money";
import { getAgenda, getDashboardCounts, getDashboardMoney } from "@/lib/repos/dashboard";
import { ITEM_STATUS_LABELS, type ItemStatus } from "@/lib/repos/orders";

export const metadata: Metadata = {
  title: "Tableau de bord",
  robots: { index: false, follow: false },
};

/** §8.1 — every indicator opens the list that produced it. */
export default async function DashboardPage() {
  const { workshop } = await requireWorkshop();
  const currency = workshop.currency as CurrencyCode;

  const counts = getDashboardCounts(workshop.id);
  const agenda = getAgenda(workshop.id, 8);
  const finance = workshop.canViewMoney ? getDashboardMoney(workshop.id, currency) : null;

  const tiles = [
    {
      label: "À livrer aujourd'hui",
      value: String(counts.dueToday),
      href: "/atelier/planning?filtre=aujourdhui",
      accent: "accent-1",
    },
    {
      label: "Échéances sous 7 jours",
      value: String(counts.dueWithinSevenDays),
      href: "/atelier/planning?filtre=semaine",
      accent: "accent-2",
    },
    {
      label: "En retard",
      value: String(counts.late),
      href: "/atelier/planning?filtre=retard",
      accent: "accent-3",
    },
    {
      label: "Prêtes, non remises",
      value: String(counts.readyNotDelivered),
      href: "/atelier/planning?filtre=pretes",
      accent: "accent-2",
    },
  ];

  return (
    <>
      <PageHeader
        title={`Bonjour, ${workshop.name}`}
        description="Ce qui demande votre attention aujourd'hui."
        action={
          <Link href="/atelier/commandes/nouvelle" className="btn btn-primary gap-2">
            <Icon name="arrowRight" className="h-4 w-4" />
            Nouvelle commande
          </Link>
        }
      />

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <li key={tile.label} className={tile.accent}>
            <Link
              href={tile.href}
              className="card-lift bg-base-100 border-base-300 block rounded-2xl border p-5"
            >
              <p className="font-display text-3xl font-extrabold text-[color:var(--accent)]">
                {tile.value}
              </p>
              <p className="text-base-content/60 mt-1 text-sm">{tile.label}</p>
            </Link>
          </li>
        ))}
      </ul>

      {/* Financial tiles only for actors with money.read (§4.2). */}
      {finance ? (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          <li className="accent-3">
            <Link
              href="/atelier/paiements?filtre=impayes"
              className="card-lift bg-base-100 border-base-300 block rounded-2xl border p-5"
            >
              <p className="text-base-content/60 text-sm">Reste à encaisser</p>
              <p className="font-display mt-1 text-2xl font-extrabold text-[color:var(--accent)]">
                {formatMoney(finance.outstanding)}
              </p>
            </Link>
          </li>
          <li className="accent-2">
            <Link
              href="/atelier/paiements"
              className="card-lift bg-base-100 border-base-300 block rounded-2xl border p-5"
            >
              <p className="text-base-content/60 text-sm">Encaissé ce mois-ci</p>
              <p className="font-display mt-1 text-2xl font-extrabold text-[color:var(--accent)]">
                {formatMoney(finance.collectedThisMonth)}
              </p>
            </Link>
          </li>
        </ul>
      ) : null}

      <section className="bg-base-100 border-base-300 mt-8 rounded-2xl border">
        <div className="border-base-300 flex items-center justify-between border-b px-6 py-4">
          <h2 className="font-display font-bold">Prochaines échéances</h2>
          <Link href="/atelier/planning" className="link link-primary text-sm font-medium">
            Voir le planning
          </Link>
        </div>

        {agenda.length === 0 ? (
          <p className="text-base-content/55 px-6 py-12 text-center text-sm">
            Aucune échéance en attente. Créez une commande pour la voir apparaître ici.
          </p>
        ) : (
          <ul className="divide-base-300 divide-y">
            {agenda.map((item) => (
              <li key={item.item_id}>
                <Link
                  href={`/atelier/commandes/${item.order_id}`}
                  className="hover:bg-base-200 flex items-center gap-4 px-6 py-4 transition-colors"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{item.description}</span>
                    <span className="text-base-content/55 block text-sm">
                      {item.client_name} · {item.reference}
                    </span>
                  </span>

                  <span className="badge badge-ghost badge-sm shrink-0">
                    {ITEM_STATUS_LABELS[item.status as ItemStatus] ?? item.status}
                  </span>

                  <DueDate value={item.due_date} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/** Late is derived from the date, never from a stored status (§8.1). */
function DueDate({ value }: { value: string | null }) {
  if (!value) {
    return <span className="text-base-content/40 w-28 shrink-0 text-right text-sm">Sans date</span>;
  }

  const late = value < new Date().toISOString().slice(0, 10);
  const formatted = new Date(`${value}T00:00:00`).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
  });

  return (
    <span
      className={`w-28 shrink-0 text-right text-sm font-medium ${late ? "text-error" : "text-base-content/60"}`}
    >
      {late ? "En retard · " : ""}
      {formatted}
    </span>
  );
}
