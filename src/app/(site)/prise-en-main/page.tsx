import type { Metadata } from "next";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import PageHero from "@/components/ui/PageHero";
import Reveal from "@/components/ui/Reveal";
import { accentAt } from "@/lib/accents";
import { listPublished } from "@/lib/repos/contents";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Prise en main",
  description: `Tutoriels courts pour démarrer avec ${site.name}, classés par tâche.`,
};

/** Tutorials are grouped by the task they cover, as §13.1 asks. */
const TASK_LABELS: Record<string, string> = {
  onboarding: "Démarrer",
  clients: "Clients et mesures",
  commandes: "Commandes",
  paiements: "Paiements",
  equipe: "Équipe et abonnement",
};

function formatDuration(seconds: number | null): string | null {
  if (!seconds) return null;
  return seconds < 60 ? `${seconds} s` : `${Math.round(seconds / 60)} min`;
}

export default async function PriseEnMainPage() {
  const tutorials = await listPublished("tutorial", 100);

  const groups = new Map<string, typeof tutorials>();
  for (const tutorial of tutorials) {
    const key = tutorial.task_key ?? "autre";
    groups.set(key, [...(groups.get(key) ?? []), tutorial]);
  }

  return (
    <>
      <PageHero
        title="Prise en main"
        subtitle="Une vidéo courte par tâche. Chacune est compréhensible sans le son, avec sa transcription."
      />

      <section className="bg-base-100 py-20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          {tutorials.length === 0 ? (
            <p className="text-base-content/55 py-12 text-center text-sm">
              Aucun tutoriel publié pour le moment.
            </p>
          ) : (
            <div className="space-y-14">
              {[...groups.entries()].map(([taskKey, items], groupIndex) => (
                <div key={taskKey}>
                  <h2 className="font-display text-xl font-bold">
                    {TASK_LABELS[taskKey] ?? "Autres"}
                  </h2>

                  <ul className="mt-5 grid gap-4 sm:grid-cols-2">
                    {items.map((tutorial, index) => {
                      const duration = formatDuration(tutorial.duration_seconds);

                      return (
                        <li key={tutorial.id} className={accentAt(groupIndex + index)}>
                          <Reveal delay={index * 80} className="h-full">
                            <article className="card-lift bg-base-200 border-base-300 h-full rounded-2xl border p-6">
                              <div className="flex items-start gap-4">
                                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] text-[color:var(--accent)]">
                                  <Icon name="sparkles" className="h-5 w-5" />
                                </span>

                                <div className="min-w-0">
                                  <h3 className="font-semibold">{tutorial.title}</h3>
                                  {duration ? (
                                    <p className="text-base-content/50 mt-0.5 text-xs">
                                      {duration}
                                    </p>
                                  ) : null}
                                </div>
                              </div>

                              {/* §13.2: the transcript stands alone, so the page is
                                  useful before any video is produced. */}
                              {tutorial.transcript ? (
                                <p className="text-base-content/70 mt-4 text-sm leading-relaxed text-pretty">
                                  {tutorial.transcript}
                                </p>
                              ) : null}

                              {tutorial.video_url ? (
                                <a
                                  href={tutorial.video_url}
                                  className="link link-primary mt-4 inline-block text-sm font-medium"
                                >
                                  Voir la vidéo
                                </a>
                              ) : (
                                <p className="text-base-content/45 mt-4 text-xs">
                                  Vidéo bientôt disponible — la transcription reste consultable.
                                </p>
                              )}
                            </article>
                          </Reveal>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <Reveal className="border-base-300 mt-14 rounded-2xl border border-dashed p-8 text-center">
            <p className="font-display font-bold">Besoin d&apos;un coup de main ?</p>
            <p className="text-base-content/60 mt-2 text-sm">
              L&apos;assistance répond sous 24 h les jours ouvrés.
            </p>
            <Link href="/contact" className="btn btn-primary mt-5">
              Contacter l&apos;assistance
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}
