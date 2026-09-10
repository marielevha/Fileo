import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/app/PageHeader";
import { requireAdmin } from "@/lib/auth/guards";
import { formatMoney } from "@/lib/money";
import { getAdminCounts, getRevenueByCurrency } from "@/lib/repos/admin";
import { accentAt } from "@/lib/accents";

export const metadata: Metadata = {
  title: "Back-office",
  robots: { index: false, follow: false },
};

export default async function AdminDashboardPage() {
  await requireAdmin("admin.dashboard");

  const counts = getAdminCounts();
  const revenue = getRevenueByCurrency();

  const tiles = [
    { label: "Ateliers inscrits", value: counts.workshops, href: "/admin/ateliers" },
    { label: "Ateliers actifs", value: counts.activeWorkshops, href: "/admin/ateliers" },
    { label: "Essais en cours", value: counts.trials, href: "/admin/ateliers" },
    { label: "Abonnements payants", value: counts.payingWorkshops, href: "/admin/ateliers" },
    { label: "Échéances sous 7 jours", value: counts.expiringSoon, href: "/admin/ateliers" },
    { label: "Règlements à valider", value: counts.pendingPayments, href: "/admin/reglements" },
    { label: "Tickets ouverts", value: counts.openTickets, href: "/admin/tickets" },
  ];

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        description="Vue d'ensemble de la plateforme Filéo."
      />

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile, index) => (
          <li key={tile.label} className={accentAt(index)}>
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

      <section className="bg-base-100 border-base-300 mt-8 rounded-2xl border p-6">
        <h2 className="font-display font-bold">Recettes Filéo encaissées</h2>
        <p className="text-base-content/55 mt-1 text-sm">
          Règlements d&apos;abonnement validés. Ces montants n&apos;incluent pas les encaissements
          des clients des ateliers.
        </p>

        {revenue.length === 0 ? (
          <p className="text-base-content/55 mt-6 text-sm">Aucun règlement validé à ce jour.</p>
        ) : (
          // §12.1: currencies are listed separately, never summed together.
          <ul className="mt-5 flex flex-wrap gap-8">
            {revenue.map((amount, index) => (
              <li key={amount.currency} className={accentAt(index)}>
                <p className="font-display text-2xl font-extrabold text-[color:var(--accent)]">
                  {formatMoney(amount)}
                </p>
                <p className="text-base-content/55 mt-0.5 text-xs">{amount.currency}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
