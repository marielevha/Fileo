import Link from "next/link";
import Logo from "@/components/layout/Logo";
import ThemeToggle from "@/components/layout/ThemeToggle";
import AppNav from "@/components/app/AppNav";
import UserMenu from "@/components/app/UserMenu";
import { requireWorkshop } from "@/lib/auth/guards";
import { canInAdmin } from "@/lib/permissions";
import LanguageSwitcher from "@/components/layout/LanguageSwitcher";
import { getLocale } from "@/lib/i18n/request";
import { getMessages } from "@/lib/i18n/messages";
import { localePath } from "@/lib/i18n/config";

export default async function AtelierLayout({ children }: { children: React.ReactNode }) {
  const [{ user, workshop, actor }, locale] = await Promise.all([
    requireWorkshop(),
    getLocale(),
  ]);
  const copy = getMessages(locale);

  // Money-related sections are hidden from actors without the right — the
  // pages themselves re-check server-side, this only avoids dead links (§4.2).
  const items = [
    { href: "/atelier", label: "Tableau de bord", icon: "layout", exact: true },
    { href: "/atelier/clients", label: "Clients", icon: "users" },
    { href: "/atelier/commandes", label: "Commandes", icon: "code" },
    { href: "/atelier/planning", label: "Planning", icon: "clock" },
    ...(workshop.canViewMoney
      ? [
          { href: "/atelier/paiements", label: "Paiements", icon: "shield" },
          { href: "/atelier/depenses", label: "Dépenses", icon: "wrench" },
        ]
      : []),
    ...(workshop.role === "owner"
      ? [
          { href: "/atelier/equipe", label: "Équipe", icon: "users" },
          { href: "/atelier/abonnement", label: "Abonnement", icon: "sparkles" },
        ]
      : []),
  ].map((item) => ({ ...item, href: localePath(locale, item.href) }));

  return (
    <div className="bg-base-200 min-h-screen">
      <header className="bg-base-100/80 border-base-300 sticky top-0 z-40 border-b backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Link href={localePath(locale, "/atelier")} aria-label={copy.nav.workshop}>
              <Logo markOnly className="sm:hidden" />
              <Logo className="hidden sm:inline-flex" />
            </Link>
            <span className="border-base-300 text-base-content/70 hidden truncate border-l pl-4 text-sm font-medium md:block">
              {workshop.name}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {canInAdmin(actor, "admin.dashboard") ? (
              <Link href={localePath(locale, "/admin")} className="btn btn-ghost btn-sm hidden sm:inline-flex">
                Back-office
              </Link>
            ) : null}
            <LanguageSwitcher locale={locale} label={copy.nav.chooseLanguage} />
            <ThemeToggle />
            <UserMenu name={user.fullName} role={workshop.role} locale={locale} />
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
