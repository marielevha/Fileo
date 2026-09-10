import Icon from "@/components/ui/Icon";
import Reveal from "@/components/ui/Reveal";
import SectionHeading from "@/components/ui/SectionHeading";
import { accentAt } from "@/lib/accents";
import { features } from "@/lib/site";

export default function Features() {
  return (
    <section id="fonctionnalites" className="bg-base-100 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="Tout l'atelier au même endroit"
          subtitle="Les mêmes données et les mêmes règles sur le web et sur le téléphone."
        />

        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <li key={feature.title} className={accentAt(index)}>
              <Reveal delay={index * 90} className="h-full">
                <article className="card-lift bg-base-200 border-base-300 flex h-full flex-col rounded-2xl border p-7">
                  <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] text-[color:var(--accent)]">
                    <Icon name={feature.icon} className="h-7 w-7" />
                  </span>

                  <h3 className="font-display mt-5 text-lg font-bold text-[color:var(--accent)]">
                    {feature.title}
                  </h3>

                  <p className="text-base-content/70 mt-3 text-sm leading-relaxed text-pretty">
                    {feature.text}
                  </p>

                  <ul className="mt-auto flex flex-wrap gap-2 pt-6">
                    {feature.tags.map((tag) => (
                      <li
                        key={tag}
                        className="rounded-full border border-[color-mix(in_oklab,var(--accent)_35%,transparent)] px-3 py-1 text-xs font-medium text-[color:var(--accent)]"
                      >
                        {tag}
                      </li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
