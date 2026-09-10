import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { heroPoints, site } from "@/lib/site";

export default function Hero() {
  return (
    <section className="relative flex min-h-[92vh] items-center overflow-hidden pt-28 pb-20">
      <div aria-hidden="true" className="absolute inset-0 -z-10">
        <div className="from-base-200 via-base-100 to-base-100 absolute inset-0 bg-gradient-to-br" />
        <div className="blob bg-primary/25 animate-float -top-32 -left-24 h-96 w-96" />
        <div
          className="blob bg-secondary/20 animate-float top-1/4 -right-32 h-[30rem] w-[30rem]"
          style={{ animationDelay: "-5s" }}
        />
        <div
          className="blob bg-accent/15 animate-float bottom-0 left-1/3 h-80 w-80"
          style={{ animationDelay: "-9s" }}
        />
      </div>

      <div className="mx-auto grid w-full max-w-7xl items-center gap-16 px-4 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:px-8">
        <div className="animate-fade-up">
          <span className="bg-primary/12 text-primary ring-primary/25 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ring-1">
            <Icon name="sparkles" className="h-4 w-4" />
            Pour les ateliers de couture
          </span>

          <h1 className="font-display mt-7 text-[length:var(--text-display)] leading-[0.95] font-extrabold">
            <span className="text-gradient-brand">{site.tagline}</span>
          </h1>

          <p className="text-base-content/80 mt-6 max-w-xl text-lg leading-relaxed text-pretty sm:text-xl">
            {site.description}
          </p>

          <ul className="mt-8 space-y-3">
            {heroPoints.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <span className="bg-success/15 text-success mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full">
                  <Icon name="check" className="h-3 w-3" strokeWidth={3} />
                </span>
                <span className="text-base-content/75">{point}</span>
              </li>
            ))}
          </ul>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/inscription" className="btn btn-primary btn-lg gap-2 shadow-lg">
              Créer mon atelier
              <Icon name="arrowRight" className="h-5 w-5" />
            </Link>
            <Link href="/#fonctionnalites" className="btn btn-outline btn-lg">
              Voir les fonctionnalités
            </Link>
          </div>

          <p className="text-base-content/50 mt-4 text-sm">
            Essai de 14 jours. Aucun moyen de paiement demandé pour démarrer.
          </p>
        </div>

        {/* Aperçu produit : maquette du tableau de bord atelier */}
        <div className="animate-fade-up hidden lg:block" style={{ animationDelay: "160ms" }}>
          <div className="from-primary/25 via-secondary/20 to-accent/20 rounded-[1.75rem] bg-gradient-to-br p-1.5 shadow-2xl">
            <div className="bg-base-100 overflow-hidden rounded-[1.4rem]">
              <div className="border-base-300 flex items-center gap-2 border-b px-4 py-3">
                <span className="bg-error/60 h-3 w-3 rounded-full" />
                <span className="bg-warning/60 h-3 w-3 rounded-full" />
                <span className="bg-success/60 h-3 w-3 rounded-full" />
                <span className="text-base-content/40 ml-3 text-xs">Mon atelier</span>
              </div>

              <div className="space-y-4 p-5">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "À livrer", value: "3", accent: "accent-1" },
                    { label: "En retard", value: "1", accent: "accent-3" },
                    { label: "Prêtes", value: "2", accent: "accent-2" },
                  ].map((tile) => (
                    <div
                      key={tile.label}
                      className={`${tile.accent} rounded-xl bg-[color-mix(in_oklab,var(--accent)_12%,transparent)] p-3`}
                    >
                      <p className="font-display text-2xl font-extrabold text-[color:var(--accent)]">
                        {tile.value}
                      </p>
                      <p className="text-base-content/55 text-xs">{tile.label}</p>
                    </div>
                  ))}
                </div>

                <div className="border-base-300 space-y-3 rounded-xl border p-4">
                  {[
                    { ref: "CMD-0001", who: "Chancelvie L.", state: "En cours", tone: "accent-2" },
                    { ref: "CMD-0002", who: "Grâce B.", state: "En retard", tone: "accent-3" },
                    { ref: "CMD-0003", who: "Rodrigue S.", state: "Prêt", tone: "accent-1" },
                  ].map((row) => (
                    <div key={row.ref} className={`${row.tone} flex items-center gap-3`}>
                      <span className="bg-base-200 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-bold">
                        {row.who.slice(0, 2)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{row.who}</span>
                        <span className="text-base-content/45 block text-xs">{row.ref}</span>
                      </span>
                      <span className="rounded-full bg-[color-mix(in_oklab,var(--accent)_16%,transparent)] px-2.5 py-1 text-xs font-semibold text-[color:var(--accent)]">
                        {row.state}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-base-300 flex items-center justify-between rounded-xl border p-4">
                  <span className="text-base-content/55 text-sm">Reste à encaisser</span>
                  <span className="font-display text-primary text-lg font-bold">37 500 FCFA</span>
                </div>
              </div>
            </div>
          </div>

          <p className="text-base-content/40 mt-3 text-center text-xs">
            Aperçu de l&apos;interface — données de démonstration.
          </p>
        </div>
      </div>
    </section>
  );
}
