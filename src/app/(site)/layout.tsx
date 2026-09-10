import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import CookieBanner from "@/components/ui/CookieBanner";
import { getSession } from "@/lib/auth/session";
import { getLocale } from "@/lib/i18n/request";

/** Public site shell (§6). Signed-in visitors get a shortcut to their workshop. */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const locale = await getLocale();

  return (
    <>
      <Navbar signedIn={Boolean(session)} locale={locale} />
      <main id="main">{children}</main>
      <Footer />
      <CookieBanner />
    </>
  );
}
