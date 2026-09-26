import Link from "next/link";
import Icon from "@/components/ui/Icon";
import Reveal from "@/components/ui/Reveal";
import { appStores } from "@/lib/site";
import { getLocale } from "@/lib/i18n/request";
import { getMessages } from "@/lib/i18n/messages";
import { localePath } from "@/lib/i18n/config";

/**
 * §6.2: "Afficher « bientôt disponible » si une application n'est pas encore
 * publiée ; aucun lien de téléchargement factice." The flags in site.ts drive
 * this — flip them only once the builds are actually live.
 */
export default async function DownloadCta() {
  const locale = await getLocale();
  const copy = getMessages(locale).download;
  const stores = [
    { key: "android", label: "Android", store: "Google Play", ...appStores.android },
    { key: "ios", label: "iOS", store: "App Store", ...appStores.ios },
  ];

  return (
    <section id="telecharger" className="bg-base-100 py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="from-primary via-primary to-secondary text-primary-content rounded-3xl bg-gradient-to-br p-10 text-center shadow-xl sm:p-14">
            <h2 className="font-display text-3xl font-extrabold text-balance sm:text-4xl">
              {copy.title}
            </h2>

            <p className="mx-auto mt-4 max-w-xl text-pretty opacity-90">
              {copy.text}
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href={localePath(locale, "/inscription")} className="btn btn-lg bg-base-100 text-primary border-0 gap-2 hover:opacity-90">
                {copy.create}
                <Icon name="arrowRight" className="h-5 w-5" />
              </Link>
              <Link href={localePath(locale, "/prise-en-main")} className="btn btn-lg btn-outline border-current">
                {copy.tutorials}
              </Link>
            </div>

            <ul className="mt-10 flex flex-wrap items-center justify-center gap-3">
              {stores.map((store) =>
                store.available && store.url ? (
                  <li key={store.key}>
                    <a
                      href={store.url}
                      className="border-current/40 hover:bg-base-100/10 inline-flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold transition-colors"
                    >
                      <Icon name="device" className="h-5 w-5" />
                      {store.store}
                    </a>
                  </li>
                ) : (
                  <li
                    key={store.key}
                    className="border-current/25 inline-flex items-center gap-2 rounded-xl border border-dashed px-5 py-3 text-sm opacity-75"
                  >
                    <Icon name="device" className="h-5 w-5" />
                    {store.label} - {copy.soon}
                  </li>
                ),
              )}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
