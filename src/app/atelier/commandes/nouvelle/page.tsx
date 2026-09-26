import type { Metadata } from "next";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import PageHeader from "@/components/app/PageHeader";
import CreateOrderForm from "@/components/orders/CreateOrderForm";
import Icon from "@/components/ui/Icon";
import { requireWorkshop } from "@/lib/auth/guards";
import { localePath } from "@/lib/i18n/config";
import { getLocale } from "@/lib/i18n/request";
import { CURRENCIES, isCurrencyCode } from "@/lib/money";
import { listArticleTemplates } from "@/lib/repos/article-templates";
import { listClients } from "@/lib/repos/clients";
import { getWorkshopMeasurementUnits } from "@/lib/repos/workshops";

export const metadata: Metadata = {
  title: "Nouvelle commande",
  robots: { index: false, follow: false },
};

export default async function NewOrderPage() {
  const { workshop } = await requireWorkshop("orders.write");
  const locale = await getLocale();
  const ordersHref = localePath(locale, "/atelier/commandes");
  const currency = isCurrencyCode(workshop.currency) ? workshop.currency : "XAF";
  const [clientsPage, articleTemplates, measurementUnits] = await Promise.all([
    listClients(workshop.id, {
      pageSize: 100,
      sort: "name",
      direction: "asc",
    }),
    listArticleTemplates(workshop.id),
    getWorkshopMeasurementUnits(workshop.id),
  ]);

  return (
    <>
      <Link
        href={ordersHref}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-base-content/60 transition-colors hover:text-primary"
      >
        <Icon name="arrowRight" className="h-4 w-4 rotate-180" />
        Toutes les commandes
      </Link>

      <PageHeader
        title="Nouvelle commande"
        description="Ajoutez le client, les articles a produire, les echeances et l'acompte initial si besoin."
      />

      <section className="rounded-2xl border border-base-300 bg-base-100 p-5 sm:p-6">
        <CreateOrderForm
          clients={clientsPage.items.map((client) => ({
            id: client.id,
            displayName: client.display_name,
            phone: client.phone_e164,
          }))}
          canViewMoney={workshop.canViewMoney}
          currencySymbol={CURRENCIES[currency].symbol}
          today={new Date().toISOString().slice(0, 10)}
          paymentIdempotencyKey={`order:${randomUUID()}`}
          cancelHref={ordersHref}
          articleTemplates={articleTemplates}
          measurementUnits={measurementUnits}
        />
      </section>
    </>
  );
}
