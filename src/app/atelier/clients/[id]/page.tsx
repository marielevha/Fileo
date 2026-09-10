import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/app/PageHeader";
import DeleteClientButton from "@/components/clients/DeleteClientButton";
import { requireWorkshop } from "@/lib/auth/guards";
import { getClient, listMeasurements } from "@/lib/repos/clients";
import { formatPhone } from "@/lib/phone";
import { getLocale } from "@/lib/i18n/request";
import { localePath } from "@/lib/i18n/config";
import { toggleClientArchiveAction } from "@/lib/actions/clients";

export const metadata: Metadata = { title: "Fiche client", robots: { index: false, follow: false } };

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { workshop } = await requireWorkshop("clients.read");
  const { id } = await params;
  const client = getClient(workshop.id, id);
  if (!client) notFound();
  const locale = await getLocale();
  const measurements = listMeasurements(workshop.id, id);

  return (
    <>
      <Link href={localePath(locale, "/atelier/clients")} className="link link-hover mb-5 inline-block text-sm text-base-content/60">Retour aux clients</Link>
      <PageHeader
        title={client.display_name}
        description={client.archived_at ? "Cette fiche est archivée." : "Fiche client active"}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href={localePath(locale, `/atelier/clients/${id}/modifier`)} className="btn btn-primary btn-sm">Modifier</Link>
            <form action={toggleClientArchiveAction.bind(null, id)}>
              <button type="submit" className="btn btn-outline btn-sm">{client.archived_at ? "Réactiver" : "Archiver"}</button>
            </form>
            <DeleteClientButton clientId={id} name={client.display_name} />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="border border-base-300 bg-base-100 p-6">
          <h2 className="font-display text-lg font-bold">Coordonnées</h2>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="text-base-content/50">Téléphone</dt><dd className="mt-1 font-medium">{client.phone_e164 ? formatPhone(client.phone_e164) : "Non renseigné"}</dd></div>
            <div><dt className="text-base-content/50">Autre contact</dt><dd className="mt-1 font-medium">{client.other_contact ?? "Non renseigné"}</dd></div>
            <div><dt className="text-base-content/50">Parent ou tuteur</dt><dd className="mt-1 font-medium">{client.guardian_name ?? "Non renseigné"}</dd></div>
            <div><dt className="text-base-content/50">Téléphone du tuteur</dt><dd className="mt-1 font-medium">{client.guardian_phone ? formatPhone(client.guardian_phone) : "Non renseigné"}</dd></div>
          </dl>
          {client.notes ? <div className="mt-6 border-t border-base-300 pt-5"><h3 className="text-sm font-semibold">Notes</h3><p className="mt-2 whitespace-pre-wrap text-sm text-base-content/70">{client.notes}</p></div> : null}
        </section>

        <section className="border border-base-300 bg-base-100 p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-display text-lg font-bold">Mesures</h2>
            <span className="badge badge-ghost">{measurements.length} relevé{measurements.length > 1 ? "s" : ""}</span>
          </div>
          {measurements.length ? (
            <ul className="mt-5 divide-y divide-base-300">
              {measurements.slice(0, 6).map((measurement) => (
                <li key={measurement.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                  <span className="font-medium capitalize">{measurement.category}</span>
                  <span className="text-base-content/55">Version {measurement.version} - {new Date(measurement.taken_at).toLocaleDateString("fr-FR")}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-5 text-sm text-base-content/55">Aucun relevé de mesures pour ce client.</p>}
        </section>
      </div>
    </>
  );
}
