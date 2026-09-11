import type { Metadata } from "next";
import PageHeader from "@/components/app/PageHeader";
import { requireAdmin } from "@/lib/auth/guards";
import { listWorkshops } from "@/lib/repos/admin";
import { COUNTRIES, type CountryCode } from "@/lib/phone";

export const metadata: Metadata = {
  title: "Ateliers",
  robots: { index: false, follow: false },
};

const SUBSCRIPTION_LABELS: Record<string, string> = {
  trial: "Essai",
  active: "Actif",
  renewal_due: "Renouvellement attendu",
  grace: "Délai de grâce",
  expired: "Expiré",
  suspended: "Suspendu",
};

export default async function AdminWorkshopsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin("admin.workshops");

  const { q = "" } = await searchParams;
  const workshops = await listWorkshops(q);

  return (
    <>
      <PageHeader
        title="Ateliers"
        description="Métadonnées et abonnement. Les mesures et photos des ateliers ne sont pas consultables ici."
      />

      <form method="get" className="mb-6 flex gap-3">
        <label className="sr-only" htmlFor="q">
          Rechercher un atelier
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Nom de l'atelier…"
          className="input input-bordered flex-1"
        />
        <button type="submit" className="btn btn-outline">
          Rechercher
        </button>
      </form>

      {workshops.length === 0 ? (
        <p className="bg-base-100 border-base-300 rounded-2xl border p-12 text-center text-sm">
          Aucun atelier ne correspond.
        </p>
      ) : (
        <div className="bg-base-100 border-base-300 overflow-hidden rounded-2xl border">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Atelier</th>
                  <th>Responsable</th>
                  <th>Pays</th>
                  <th>Devise</th>
                  <th className="text-right">Membres</th>
                  <th>Abonnement</th>
                  <th>Échéance</th>
                </tr>
              </thead>
              <tbody>
                {workshops.map((workshop) => (
                  <tr key={workshop.id} className="hover:bg-base-200">
                    <td>
                      <span className="font-medium">{workshop.name}</span>
                      {workshop.status === "suspended" ? (
                        <span className="badge badge-error badge-sm ml-2">Suspendu</span>
                      ) : null}
                      {workshop.city ? (
                        <span className="text-base-content/50 block text-xs">{workshop.city}</span>
                      ) : null}
                    </td>
                    <td className="text-base-content/70">{workshop.owner_name}</td>
                    <td className="text-base-content/70 text-sm">
                      {COUNTRIES[workshop.country_code as CountryCode]?.label ??
                        workshop.country_code}
                    </td>
                    <td>
                      <span className="badge badge-ghost badge-sm">{workshop.currency}</span>
                    </td>
                    <td className="text-right">{workshop.member_count}</td>
                    <td>
                      {workshop.subscription_status ? (
                        <span className="badge badge-sm">
                          {SUBSCRIPTION_LABELS[workshop.subscription_status] ??
                            workshop.subscription_status}
                        </span>
                      ) : (
                        <span className="text-base-content/40">—</span>
                      )}
                    </td>
                    <td className="text-base-content/60 text-sm">
                      {workshop.current_period_end
                        ? new Date(`${workshop.current_period_end}T00:00:00`).toLocaleDateString(
                            "fr-FR",
                          )
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
        Un diagnostic nécessitant l&apos;accès aux données métier passe par un accès
        d&apos;assistance temporaire, autorisé par le responsable et journalisé.
      </p>
    </>
  );
}
