import Link from "next/link";
import Reveal from "@/components/ui/Reveal";
import SectionHeading from "@/components/ui/SectionHeading";
import { accentAt } from "@/lib/accents";
import { steps } from "@/lib/site";

export default function Steps() {
  return (
    <section id="prise-en-main" className="bg-base-200 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="Démarrer prend quelques minutes"
          subtitle="Pas de paramétrage long avant de pouvoir enregistrer une première commande."
        />

        <ol className="relative grid gap-12 md:grid-cols-4">
          <span
            aria-hidden="true"
            className="via-base-300 absolute top-8 right-[12%] left-[12%] hidden h-px bg-gradient-to-r from-transparent to-transparent md:block"
          />

          {steps.map((step, index) => (
            <li key={step.step} className={`${accentAt(index)} relative`}>
              <Reveal delay={index * 120} className="text-center">
                <span className="font-display bg-base-100 relative z-10 mx-auto grid h-16 w-16 place-items-center rounded-full text-lg font-extrabold text-[color:var(--accent)] shadow-lg ring-2 ring-[color-mix(in_oklab,var(--accent)_45%,transparent)]">
                  {step.step}
                </span>
                <h3 className="font-display mt-5 text-lg font-bold">{step.title}</h3>
                <p className="text-base-content/65 mx-auto mt-2 max-w-xs text-sm leading-relaxed text-pretty">
                  {step.text}
                </p>
              </Reveal>
            </li>
          ))}
        </ol>

        {/* The anchored section stays a summary; the full tutorial library
            required by §6.1 lives on its own page. */}
        <Reveal className="mt-16 text-center">
          <Link href="/prise-en-main" className="btn btn-outline btn-lg">
            Voir tous les tutoriels
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
