import Link from "next/link";
import Logo from "./Logo";
import Icon from "@/components/ui/Icon";
import { footerProduct, footerSupport, legalLinks, site } from "@/lib/site";
import { getLocale } from "@/lib/i18n/request";
import { getMessages } from "@/lib/i18n/messages";
import { localePath } from "@/lib/i18n/config";

export default async function Footer() {
  const locale = await getLocale();
  const copy = getMessages(locale);
  const productLabels = [copy.nav.features, copy.nav.pricing, copy.footer.download, copy.footer.news];
  const supportLabels = [copy.footer.gettingStarted, copy.footer.faq, copy.footer.contactLink];
  // base-300 rather than `neutral`: in synthwave, neutral is a vivid indigo.
  return (
    <footer className="bg-base-300 text-base-content">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <Logo />
            <p className="text-base-content/65 mt-5 max-w-sm text-sm leading-relaxed">
              {copy.footer.description}
            </p>

            <p className="text-base-content/50 mt-5 text-xs">
              {copy.footer.markets}
            </p>
          </div>

          <nav aria-labelledby="footer-product">
            <h2 id="footer-product" className="text-primary font-display text-base font-bold">
              {copy.footer.product}
            </h2>
            <ul className="mt-5 space-y-3 text-sm">
              {footerProduct.map((link, index) => (
                <li key={link.href}>
                  <Link
                    href={localePath(locale, link.href)}
                    className="text-base-content/65 hover:text-primary transition-colors"
                  >
                    {productLabels[index]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-support">
            <h2 id="footer-support" className="text-primary font-display text-base font-bold">
              {copy.footer.support}
            </h2>
            <ul className="mt-5 space-y-3 text-sm">
              {footerSupport.map((link, index) => (
                <li key={link.href}>
                  <Link
                    href={localePath(locale, link.href)}
                    className="text-base-content/65 hover:text-primary transition-colors"
                  >
                    {supportLabels[index]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="text-primary font-display text-base font-bold">{copy.footer.contact}</h2>
            <ul className="mt-5 space-y-3.5 text-sm">
              <li>
                <a
                  href={`mailto:${site.email}`}
                  className="text-base-content/65 hover:text-primary inline-flex items-center gap-2.5 transition-colors"
                >
                  <Icon name="mail" className="h-4 w-4 shrink-0" />
                  {site.email}
                </a>
              </li>
              <li>
                <Link
                  href={localePath(locale, "/connexion")}
                  className="text-base-content/65 hover:text-primary inline-flex items-center gap-2.5 transition-colors"
                >
                  <Icon name="users" className="h-4 w-4 shrink-0" />
                  {copy.footer.workshop}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-base-content/12 mt-14 flex flex-col items-center justify-between gap-4 border-t pt-8 text-sm sm:flex-row">
          <p className="text-base-content/55">
            © {site.foundedYear} {site.name}. {copy.footer.rights}
          </p>
          <ul className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2">
            {legalLinks.map((link, index) => (
              <li key={link.href}>
                <Link
                  href={localePath(locale, link.href)}
                  className="text-base-content/55 hover:text-primary transition-colors"
                >
                  {copy.footer.legal[index]}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
