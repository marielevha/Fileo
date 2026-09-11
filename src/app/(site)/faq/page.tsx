import type { Metadata } from "next";
import Link from "next/link";
import PageHero from "@/components/ui/PageHero";
import Reveal from "@/components/ui/Reveal";
import { listPublished } from "@/lib/repos/contents";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "FAQ",
  description: `Questions fréquentes sur ${site.name} : compte, tarifs, paiements, appareils et données.`,
};

export default async function FaqPage() {
  const entries = await listPublished("faq", 100);

  return (
    <>
      <PageHero
        title="Questions fréquentes"
        subtitle="Compte, tarifs, appareils, données : les réponses aux points soulevés le plus souvent."
      />

      <section className="bg-base-100 py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          {entries.length === 0 ? (
            <p className="text-base-content/55 py-12 text-center text-sm">
              Aucune question publiée pour le moment.
            </p>
          ) : (
            <div className="space-y-3">
              {entries.map((entry, index) => (
                <Reveal key={entry.id} delay={index * 60}>
                  <details className="group bg-base-200 border-base-300 rounded-2xl border p-5 [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold">
                      {entry.title}
                      <span
                        aria-hidden="true"
                        className="text-primary shrink-0 text-xl transition-transform group-open:rotate-45"
                      >
                        +
                      </span>
                    </summary>
                    <p className="text-base-content/70 mt-3 text-sm leading-relaxed text-pretty">
                      {entry.body}
                    </p>
                  </details>
                </Reveal>
              ))}
            </div>
          )}

          <Reveal className="border-base-300 mt-12 rounded-2xl border border-dashed p-8 text-center">
            <p className="font-display font-bold">Votre question n&apos;est pas là ?</p>
            <p className="text-base-content/60 mt-2 text-sm">
              Écrivez-nous, nous répondons sous 24 h les jours ouvrés.
            </p>
            <Link href="/contact" className="btn btn-primary mt-5">
              Nous contacter
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}
