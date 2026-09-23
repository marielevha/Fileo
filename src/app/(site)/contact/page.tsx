import type { Metadata } from "next";
import ContactForm from "./ContactForm";
import Icon from "@/components/ui/Icon";
import PageHero from "@/components/ui/PageHero";
import Reveal from "@/components/ui/Reveal";
import { site } from "@/lib/site";
import { getSupportContact } from "@/lib/repos/support-contact";

export const metadata: Metadata = {
  title: "Contact",
  description: `Contacter l'assistance ${site.name}.`,
};

export default async function ContactPage() {
  const { email: supportEmail } = await getSupportContact();
  return (
    <>
      <PageHero
        title="Nous contacter"
        subtitle="Une question sur votre compte, votre abonnement ou une commande ? Écrivez-nous."
      />

      <section className="bg-base-100 py-20">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 sm:px-6 lg:grid-cols-3 lg:px-8">
          <Reveal className="lg:col-span-2">
            <ContactForm />
          </Reveal>

          <div className="space-y-6">
            <Reveal delay={100}>
              <div className="accent-1 bg-base-200 border-base-300 rounded-2xl border p-6">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] text-[color:var(--accent)]">
                  <Icon name="mail" className="h-5 w-5" />
                </span>
                <h2 className="font-display mt-4 font-bold">Par email</h2>
                <a
                  href={`mailto:${supportEmail}`}
                  className="link link-primary mt-1 block text-sm break-words"
                >
                  {supportEmail}
                </a>
              </div>
            </Reveal>

            <Reveal delay={200}>
              <div className="accent-2 bg-base-200 border-base-300 rounded-2xl border p-6">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-[color-mix(in_oklab,var(--accent)_14%,transparent)] text-[color:var(--accent)]">
                  <Icon name="clock" className="h-5 w-5" />
                </span>
                <h2 className="font-display mt-4 font-bold">Délai de réponse</h2>
                {/* §13.3: never advertise availability the organisation cannot hold. */}
                <p className="text-base-content/70 mt-1 text-sm">
                  Sous 24 h les jours ouvrés, du lundi au vendredi.
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>
    </>
  );
}
