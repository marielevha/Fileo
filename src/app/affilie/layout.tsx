import Link from "next/link";
import AppNav from "@/components/app/AppNav";
import UserMenu from "@/components/app/UserMenu";
import Logo from "@/components/layout/Logo";
import LanguageSwitcher from "@/components/layout/LanguageSwitcher";
import ThemeToggle from "@/components/layout/ThemeToggle";
import { requireAffiliate } from "@/lib/auth/guards";
import { getLocale } from "@/lib/i18n/request";
import { getMessages } from "@/lib/i18n/messages";
import { localePath } from "@/lib/i18n/config";

export default async function AffiliateLayout({ children }: { children: React.ReactNode }) {
  const [{ user, workshop }, locale] = await Promise.all([
    requireAffiliate(),
    getLocale(),
  ]);
  const copy = getMessages(locale);
  const items = [
    { href: localePath(locale, "/affilie"), label: "Tableau de bord", icon: "layout", exact: true },
  ];

  return (
    <div className="bg-base-200 min-h-screen">
      <header className="bg-base-100/80 border-base-300 sticky top-0 z-40 border-b backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Link href={localePath(locale, "/affilie")} aria-label="Fileo affiliation">
              <Logo markOnly className="sm:hidden" />
              <Logo className="hidden sm:inline-flex" />
            </Link>
            <span className="badge badge-primary badge-outline hidden sm:inline-flex">
              Affiliation
            </span>
          </div>

          <div className="flex items-center gap-2">
            {workshop ? (
              <Link href={localePath(locale, "/atelier")} className="btn btn-ghost btn-sm hidden sm:inline-flex">
                Atelier
              </Link>
            ) : null}
            <LanguageSwitcher locale={locale} label={copy.nav.chooseLanguage} />
            <ThemeToggle />
            <UserMenu name={user.fullName} role="affiliate" locale={locale} />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <AppNav items={items} />
        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
