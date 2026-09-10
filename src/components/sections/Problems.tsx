import Icon from "@/components/ui/Icon";
import Reveal from "@/components/ui/Reveal";
import SectionHeading from "@/components/ui/SectionHeading";
import { accentAt } from "@/lib/accents";
import { problems } from "@/lib/site";

export default function Problems() {
  return (
    <section className="bg-base-200 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="Ce que Filéo vient régler"
          subtitle="Les difficultés que rencontrent les ateliers quand les commandes s'accumulent."
        />

        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {problems.map((problem, index) => (
            <li key={problem.title} className={accentAt(index)}>
              <Reveal delay={index * 100} className="h-full">
                <article className="card-lift bg-base-100 border-base-300 h-full rounded-2xl border p-7">
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] text-[color:var(--accent)]">
                    <Icon name={problem.icon} className="h-6 w-6" />
                  </span>
                  <h3 className="font-display mt-5 text-lg font-bold">{problem.title}</h3>
                  <p className="text-base-content/70 mt-2.5 text-sm leading-relaxed text-pretty">
                    {problem.text}
                  </p>
                </article>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
