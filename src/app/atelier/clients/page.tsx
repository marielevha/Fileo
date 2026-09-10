import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/app/PageHeader";
import Icon from "@/components/ui/Icon";
import ClientListControls from "@/components/clients/ClientListControls";
import { requireWorkshop } from "@/lib/auth/guards";
import { listClients, type ClientSort, type SortDirection } from "@/lib/repos/clients";
import { formatPhone } from "@/lib/phone";
import { getLocale } from "@/lib/i18n/request";
import { localePath } from "@/lib/i18n/config";

export const metadata: Metadata = { title: "Clients", robots: { index: false, follow: false } };

type Props = {
  searchParams: Promise<{
    q?: string;
    archives?: string;
    page?: string;
    taille?: string;
    sort?: string;
    dir?: string;
  }>;
};

const sorts: ClientSort[] = ["name", "phone", "orders", "lastOrder", "createdAt"];

export default async function ClientsPage({ searchParams }: Props) {
  const { workshop } = await requireWorkshop("clients.read");
  const locale = await getLocale();
  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const includeArchived = params.archives === "1";
  const sort = sorts.includes(params.sort as ClientSort) ? (params.sort as ClientSort) : "name";
  const direction: SortDirection = params.dir === "desc" ? "desc" : "asc";
  const pageSize = [10, 20, 50].includes(Number(params.taille)) ? Number(params.taille) : 20;
  const result = listClients(workshop.id, {
    search,
    includeArchived,
    sort,
    direction,
    page: Number(params.page) || 1,
    pageSize,
  });
  const listPath = localePath(locale, "/atelier/clients");

  function pageHref(page: number) {
    const next = new URLSearchParams();
    if (search) next.set("q", search);
    if (includeArchived) next.set("archives", "1");
    if (sort !== "name") next.set("sort", sort);
    if (direction !== "asc") next.set("dir", direction);
    if (pageSize !== 20) next.set("taille", String(pageSize));
    if (page > 1) next.set("page", String(page));
    const query = next.toString();
    return query ? `${listPath}?${query}` : listPath;
  }

  return (
    <>
      <PageHeader
        title="Clients"
        description="Ajoutez, recherchez et suivez toutes les fiches de l'atelier."
        action={
          <Link href={localePath(locale, "/atelier/clients/nouveau")} className="btn btn-primary gap-2">
            <Icon name="users" className="h-4 w-4" />
            Ajouter un client
          </Link>
        }
      />

      <ClientListControls
        key={`${search}-${sort}-${direction}-${includeArchived}-${pageSize}`}
        search={search}
        sort={sort}
        direction={direction}
        includeArchived={includeArchived}
        pageSize={pageSize}
      />

      {result.items.length === 0 ? (
        <div className="border border-base-300 bg-base-100 p-12 text-center">
          <p className="font-medium">
            {search ? "Aucun client ne correspond à cette recherche." : "Aucun client pour le moment."}
          </p>
          <p className="mt-1.5 text-sm text-base-content/55">Un nom suffit pour créer une fiche.</p>
          <Link href={localePath(locale, "/atelier/clients/nouveau")} className="btn btn-primary mt-6">
            Ajouter un client
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden border border-base-300 bg-base-100">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Téléphone</th>
                  <th className="text-right">Commandes</th>
                  <th className="text-right">Dernière commande</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((client) => (
                  <tr key={client.id} className="hover:bg-base-200">
                    <td>
                      <Link href={localePath(locale, `/atelier/clients/${client.id}`)} className="font-medium transition-colors hover:text-primary">
                        {client.display_name}
                      </Link>
                      {client.archived_at ? <span className="badge badge-ghost badge-sm ml-2">Archivé</span> : null}
                    </td>
                    <td className="text-base-content/70">
                      {client.phone_e164 ? formatPhone(client.phone_e164) : <span className="text-base-content/40">-</span>}
                    </td>
                    <td className="text-right">{client.order_count}</td>
                    <td className="text-right text-sm text-base-content/60">
                      {client.last_order_at ? new Date(client.last_order_at).toLocaleDateString("fr-FR") : "-"}
                    </td>
                    <td className="text-right">
                      <Link href={localePath(locale, `/atelier/clients/${client.id}/modifier`)} className="btn btn-ghost btn-sm">
                        Modifier
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 text-sm">
        <p className="text-base-content/55">
          {result.total} fiche{result.total > 1 ? "s" : ""} - page {result.page} sur {result.pageCount}
        </p>
        {result.pageCount > 1 ? (
          <nav aria-label="Pagination des clients" className="join">
            <Link href={pageHref(result.page - 1)} aria-disabled={result.page === 1} className={`btn btn-sm join-item ${result.page === 1 ? "btn-disabled" : ""}`}>
              Précédent
            </Link>
            {Array.from({ length: result.pageCount }, (_, index) => index + 1)
              .filter((page) => Math.abs(page - result.page) <= 2 || page === 1 || page === result.pageCount)
              .map((page) => (
                <Link key={page} href={pageHref(page)} aria-current={page === result.page ? "page" : undefined} className={`btn btn-sm join-item ${page === result.page ? "btn-active" : ""}`}>
                  {page}
                </Link>
              ))}
            <Link href={pageHref(result.page + 1)} aria-disabled={result.page === result.pageCount} className={`btn btn-sm join-item ${result.page === result.pageCount ? "btn-disabled" : ""}`}>
              Suivant
            </Link>
          </nav>
        ) : null}
      </div>
    </>
  );
}
