import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/app/PageHeader";
import Icon from "@/components/ui/Icon";
import { requireWorkshop } from "@/lib/auth/guards";
import { listClients } from "@/lib/repos/clients";
import { formatPhone } from "@/lib/phone";

export const metadata: Metadata = {
  title: "Clients",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{ q?: string; archives?: string }>;
};

export default async function ClientsPage({ searchParams }: Props) {
  const { workshop } = await requireWorkshop("clients.read");
  const params = await searchParams;

  const search = params.q ?? "";
  const includeArchived = params.archives === "1";
  const clients = listClients(workshop.id, { search, includeArchived });

  return (
    <>
      <PageHeader
        title="Clients"
        description="Retrouvez une fiche par nom ou par téléphone."
        action={
          <Link href="/atelier/clients/nouveau" className="btn btn-primary gap-2">
            <Icon name="users" className="h-4 w-4" />
            Ajouter un client
          </Link>
        }
      />

      <form method="get" className="mb-6 flex flex-wrap items-center gap-3">
        <div className="min-w-56 flex-1">
          <label className="sr-only" htmlFor="q">
            Rechercher un client
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={search}
            placeholder="Nom ou téléphone…"
            className="input input-bordered w-full"
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="archives"
            value="1"
            defaultChecked={includeArchived}
            className="checkbox checkbox-sm"
          />
          Inclure les archivés
        </label>

        <button type="submit" className="btn btn-outline">
          Rechercher
        </button>
      </form>

      {clients.length === 0 ? (
        <div className="bg-base-100 border-base-300 rounded-2xl border p-12 text-center">
          <p className="font-medium">
            {search ? "Aucun client ne correspond à cette recherche." : "Aucun client pour le moment."}
          </p>
          <p className="text-base-content/55 mt-1.5 text-sm">
            Un nom suffit pour créer une fiche : le téléphone reste facultatif.
          </p>
          <Link href="/atelier/clients/nouveau" className="btn btn-primary mt-6">
            Ajouter un client
          </Link>
        </div>
      ) : (
        <div className="bg-base-100 border-base-300 overflow-hidden rounded-2xl border">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Téléphone</th>
                  <th className="text-right">Commandes</th>
                  <th className="text-right">Dernière commande</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id} className="hover:bg-base-200">
                    <td>
                      <Link
                        href={`/atelier/clients/${client.id}`}
                        className="font-medium hover:text-primary transition-colors"
                      >
                        {client.display_name}
                      </Link>
                      {client.archived_at ? (
                        <span className="badge badge-ghost badge-sm ml-2">Archivé</span>
                      ) : null}
                    </td>
                    <td className="text-base-content/70">
                      {client.phone_e164 ? (
                        formatPhone(client.phone_e164)
                      ) : (
                        <span className="text-base-content/40">—</span>
                      )}
                    </td>
                    <td className="text-right">{client.order_count}</td>
                    <td className="text-base-content/60 text-right text-sm">
                      {client.last_order_at
                        ? new Date(client.last_order_at).toLocaleDateString("fr-FR")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-base-content/45 mt-4 text-xs">
        {clients.length} fiche{clients.length > 1 ? "s" : ""} affichée
        {clients.length > 1 ? "s" : ""}.
      </p>
    </>
  );
}
