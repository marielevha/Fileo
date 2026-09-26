import PageHeader from "@/components/app/PageHeader";
import JoinAffiliateProgramForm from "./JoinAffiliateProgramForm";
import { requireWorkshop } from "@/lib/auth/guards";
import { getAffiliateOverviewForUser } from "@/lib/repos/affiliates";

export const metadata = { title: "Affiliation", robots: { index: false, follow: false } };

export default async function WorkshopAffiliatePage() {
  const session = await requireWorkshop();
  const overview = await getAffiliateOverviewForUser(session.user.id);
  const isOwner = session.workshop.role === "owner";

  return (
    <>
      <PageHeader title="Affiliation" description="Recommandez Fileo a d'autres ateliers et suivez vos commissions." />
      {!overview.profile ? (
        <section className="rounded-2xl border border-base-300 bg-base-100 p-6">
          <h2 className="font-display text-xl font-bold">{overview.settings.public_title}</h2>
          <p className="mt-2 text-sm text-base-content/60">
            {overview.settings.public_description}
          </p>
          {overview.settings.enabled ? <JoinAffiliateProgramForm disabled={!isOwner} /> : (
            <p className="alert alert-warning mt-4 text-sm">Le programme est temporairement ferme aux nouvelles inscriptions.</p>
          )}
          {!isOwner ? (
            <p className="mt-3 text-sm text-base-content/55">
              Seul le responsable de l&apos;atelier peut rejoindre le programme.
            </p>
          ) : null}
        </section>
      ) : (
        <div className="grid gap-6">
          <section className="rounded-2xl border border-primary/30 bg-primary/10 p-6">
            <p className="text-sm font-medium text-primary">Votre code affilie</p>
            <p className="mt-2 font-display text-4xl font-bold">{overview.profile.code}</p>
            <p className="mt-2 text-sm text-base-content/60">Partagez ce code aux ateliers pendant leur inscription.</p>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            {overview.totals.length ? overview.totals.map((total) => (
              <div key={total.currency} className="rounded-2xl border border-base-300 bg-base-100 p-5">
                <p className="text-sm text-base-content/55">{total.currency}</p>
                <p className="mt-1 text-2xl font-bold">{total.pending.toLocaleString("fr-FR")} en attente</p>
                <p className="text-sm text-base-content/55">{total.paid.toLocaleString("fr-FR")} deja paye</p>
              </div>
            )) : <p className="rounded-2xl border border-base-300 bg-base-100 p-5 text-sm text-base-content/55">Aucune commission pour le moment.</p>}
          </section>

          <section className="rounded-2xl border border-base-300 bg-base-100">
            <div className="border-b border-base-300 px-5 py-4">
              <h2 className="font-display font-bold">Ateliers recommandes</h2>
            </div>
            <div className="divide-y divide-base-300">
              {overview.attributions.length ? overview.attributions.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                  <span className="font-medium">{item.workshop_name}</span>
                  <span className="text-base-content/55">{new Date(item.attributed_at).toLocaleDateString("fr-FR")}</span>
                </div>
              )) : <p className="px-5 py-8 text-center text-sm text-base-content/55">Aucun atelier recommande pour le moment.</p>}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
