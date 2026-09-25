import Link from "next/link";
import Icon from "@/components/ui/Icon";
import Reveal from "@/components/ui/Reveal";
import SectionHeading from "@/components/ui/SectionHeading";
import { formatMoney, money, type CurrencyCode } from "@/lib/money";
import { listActivePlans, parseLimits } from "@/lib/repos/contents";
import { getLocale } from "@/lib/i18n/request";
import { getMessages } from "@/lib/i18n/messages";
import { localePath } from "@/lib/i18n/config";

/**
 * §6.2 / §11.1: the displayed price, period and limits must match the offer
 * actually granted at signup — so they are read from the same `plans` table
 * the subscription references, never hard-coded in the page.
 */
export default async function Pricing() {
  const locale = await getLocale();
  const copy = getMessages(locale).pricing;
  const plans = await listActivePlans();

  return (
    <section id="tarifs" className="bg-base-100 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading title={copy.title} subtitle={copy.note} />

        {plans.length === 0 ? (
          <Reveal className="mx-auto max-w-xl text-center">
            <p className="alert alert-info justify-center text-sm">
              {copy.empty}
            </p>
          </Reveal>
        ) : (
          <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2 xl:grid-cols-3">
            {plans.map((plan, index) => {
              const limits = parseLimits(plan.limits_json);
              const price = money(plan.price_amount, plan.currency as CurrencyCode);
              const planLabel = copy.plans[plan.code as keyof typeof copy.plans] ?? plan.label;

              return (
                <Reveal key={plan.id} delay={index * 120}>
                  <article
                    className={`${index % 2 === 0 ? "accent-1" : "accent-2"} card-lift bg-base-200 border-base-300 h-full rounded-2xl border p-8`}
                  >
                    <p className="text-base-content/55 text-sm font-medium">
                      {plan.country_code === "CG" ? copy.country : plan.country_code}
                    </p>

                    <h3 className="font-display mt-1 text-xl font-bold">{planLabel}</h3>

                    <p className="mt-5 flex items-baseline gap-1.5">
                      <span className="font-display text-primary text-4xl font-extrabold">
                        {formatMoney(price)}
                      </span>
                      <span className="text-base-content/55 text-sm">
                        / {plan.period_months === 1 ? copy.month : `${plan.period_months} ${copy.month}`}
                      </span>
                    </p>

                    <p className="text-base-content/50 mt-1 text-xs">
                      {copy.terms}
                    </p>

                    <ul className="mt-6 space-y-2.5">
                      {copy.features.map((item) => (
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
                        <dt className="text-base-content/55">{copy.members}</dt>
                        <dd className="font-medium">{limits.members ?? copy.pending}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-base-content/55">{copy.templates}</dt>
                        <dd className="font-medium">{limits.templates ?? copy.pending}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-base-content/55">{copy.notifications}</dt>
                        <dd className="font-medium">{limits.notifications ? copy.included : copy.notIncluded}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-base-content/55">{copy.storage}</dt>
                        <dd className="font-medium">
                          {limits.storageMb ? `${limits.storageMb} Mo` : copy.pending}
                        </dd>
                      </div>
                    </dl>

                    <Link
                      href={`${localePath(locale, "/inscription")}?offre=${encodeURIComponent(plan.code)}`}
                      className="btn btn-primary mt-7 w-full"
                    >
                      {copy.trial.replace("14", String(plan.trial_days))}
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
