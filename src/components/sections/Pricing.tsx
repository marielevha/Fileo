import Link from "next/link";
import Icon from "@/components/ui/Icon";
import Reveal from "@/components/ui/Reveal";
import SectionHeading from "@/components/ui/SectionHeading";
import { formatMoney, money, type CurrencyCode } from "@/lib/money";
import { listActivePlans, parseLimits } from "@/lib/repos/contents";
import { COUNTRIES, type CountryCode } from "@/lib/phone";
import { includedFeatures, pricingNote } from "@/lib/site";

/**
 * §6.2 / §11.1: the displayed price, period and limits must match the offer
 * actually granted at signup — so they are read from the same `plans` table
 * the subscription references, never hard-coded in the page.
 */
export default function Pricing() {
  const plans = listActivePlans();

  return (
    <section id="tarifs" className="bg-base-100 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading title="Un tarif simple" subtitle={pricingNote} />

        {plans.length === 0 ? (
          <Reveal className="mx-auto max-w-xl text-center">
            <p className="alert alert-info justify-center text-sm">
              Aucune offre n&apos;est publiée pour le moment.
            </p>
          </Reveal>
        ) : (
          <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
            {plans.map((plan, index) => {
              const limits = parseLimits(plan.limits_json);
              const country = COUNTRIES[plan.country_code as CountryCode];
              const price = money(plan.price_amount, plan.currency as CurrencyCode);

              return (
                <Reveal key={plan.id} delay={index * 120}>
                  <article className="accent-1 card-lift bg-base-200 border-base-300 h-full rounded-2xl border p-8">
                    <p className="text-base-content/55 text-sm font-medium">
                      {country?.label ?? plan.country_code}
                    </p>

                    <h3 className="font-display mt-1 text-xl font-bold">{plan.label}</h3>

                    <p className="mt-5 flex items-baseline gap-1.5">
                      <span className="font-display text-primary text-4xl font-extrabold">
                        {formatMoney(price)}
                      </span>
                      <span className="text-base-content/55 text-sm">
                        / {plan.period_months === 1 ? "mois" : `${plan.period_months} mois`}
                      </span>
                    </p>

                    <p className="text-base-content/50 mt-1 text-xs">
                      Par atelier. Renouvellement mensuel, résiliable à tout moment.
                    </p>

                    <ul className="mt-6 space-y-2.5">
                      {includedFeatures.map((item) => (
                        <li key={item} className="flex items-start gap-2.5 text-sm">
                          <span className="bg-success/15 text-success mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full">
                            <Icon name="check" className="h-3 w-3" strokeWidth={3} />
                          </span>
                          {item}
                        </li>
                      ))}
                    </ul>

                    {/* §11.1: never advertise "illimité" before the limits are settled. */}
                    <dl className="border-base-300 mt-6 space-y-1.5 border-t pt-5 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-base-content/55">Membres inclus</dt>
                        <dd className="font-medium">{limits.members ?? "À définir"}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-base-content/55">Stockage photos</dt>
                        <dd className="font-medium">
                          {limits.storageMb ? `${limits.storageMb} Mo` : "À définir"}
                        </dd>
                      </div>
                    </dl>

                    <Link href="/inscription" className="btn btn-primary mt-7 w-full">
                      Commencer l&apos;essai de 14 jours
                    </Link>
                  </article>
                </Reveal>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
