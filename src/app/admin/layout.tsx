import Link from "next/link";
import Logo from "@/components/layout/Logo";
import ThemeToggle from "@/components/layout/ThemeToggle";
import AppNav from "@/components/app/AppNav";
import UserMenu from "@/components/app/UserMenu";
import { requireAdmin } from "@/lib/auth/guards";
import { canInAdmin } from "@/lib/permissions";
import LanguageSwitcher from "@/components/layout/LanguageSwitcher";
import { getLocale } from "@/lib/i18n/request";
import { getMessages } from "@/lib/i18n/messages";
import { localePath } from "@/lib/i18n/config";

/** Back-office shell (§12). Menu entries follow the caller's habilitations. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [{ user, actor }, locale] = await Promise.all([
    requireAdmin(),
    getLocale(),
  ]);
  const copy = getMessages(locale);

  const items = [
    { href: "/admin", label: "Tableau de bord", icon: "layout", exact: true },
    ...(canInAdmin(actor, "admin.workshops")
      ? [{ href: "/admin/ateliers", label: "Ateliers", icon: "users" }]
      : []),
    ...(canInAdmin(actor, "admin.subscriptions")
      ? [{ href: "/admin/offres", label: "Offres", icon: "sparkles" }]
      : []),
    ...(canInAdmin(actor, "admin.payments.validate")
      ? [{ href: "/admin/reglements", label: "Règlements", icon: "shield" }]
      : []),
    ...(canInAdmin(actor, "admin.contents")
      ? [{ href: "/admin/contenus", label: "Contenus", icon: "code" }]
      : []),
    ...(canInAdmin(actor, "admin.tickets")
      ? [{ href: "/admin/tickets", label: "Assistance", icon: "mail" }]
      : []),
    ...(canInAdmin(actor, "admin.audit")
      ? [{ href: "/admin/audit", label: "Audit", icon: "clock" }]
      : []),
  ].map((item) => ({ ...item, href: localePath(locale, item.href) }));

  return (
    <div className="bg-base-200 min-h-screen">
      <header className="bg-base-100/80 border-base-300 sticky top-0 z-40 border-b backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4">
            <Link href={localePath(locale, "/admin")} aria-label="Filéo - back-office">
              <Logo />
            </Link>
            <span className="badge badge-secondary badge-sm hidden sm:inline-flex">
              Back-office
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link href={localePath(locale, "/atelier")} className="btn btn-ghost btn-sm hidden sm:inline-flex">
              {copy.nav.workshop}
            </Link>
            <LanguageSwitcher locale={locale} label={copy.nav.chooseLanguage} />
            <ThemeToggle />
            <UserMenu name={user.fullName} role="staff" locale={locale} />
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
