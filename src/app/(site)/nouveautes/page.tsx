import type { Metadata } from "next";
import PageHero from "@/components/ui/PageHero";
import Reveal from "@/components/ui/Reveal";
import { accentAt } from "@/lib/accents";
import { listPublished } from "@/lib/repos/contents";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Nouveautés",
  description: `Les évolutions de ${site.name}, datées et par support.`,
};

export default async function NouveautesPage() {
  const posts = await listPublished("news", 50);

  return (
    <>
      <PageHero
        title="Nouveautés"
        subtitle="Ce qui change dans Filéo, daté et vérifiable."
      />

      <section className="bg-base-100 py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          {posts.length === 0 ? (
            <p className="text-base-content/55 py-12 text-center text-sm">
              Aucune actualité publiée pour le moment.
            </p>
          ) : (
            <ol className="space-y-6">
              {posts.map((post, index) => (
                <li key={post.id} className={accentAt(index)}>
                  <Reveal delay={index * 80}>
                    <article className="card-lift bg-base-200 border-base-300 rounded-2xl border p-7">
                      {post.published_at ? (
                        <time
                          dateTime={post.published_at}
                          className="text-xs font-semibold tracking-wide text-[color:var(--accent)] uppercase"
                        >
                          {new Date(post.published_at).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </time>
                      ) : null}

                      <h2 className="font-display mt-2 text-xl font-bold">{post.title}</h2>

                      {post.summary ? (
                        <p className="text-base-content/70 mt-2 text-pretty">{post.summary}</p>
                      ) : null}

                      {post.body ? (
                        <p className="text-base-content/60 mt-4 text-sm leading-relaxed text-pretty">
                          {post.body}
                        </p>
                      ) : null}
                    </article>
                  </Reveal>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </>
  );
}
