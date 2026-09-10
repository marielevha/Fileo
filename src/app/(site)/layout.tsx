import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import CookieBanner from "@/components/ui/CookieBanner";
import { getSession } from "@/lib/auth/session";

/** Public site shell (§6). Signed-in visitors get a shortcut to their workshop. */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  return (
    <>
      <Navbar signedIn={Boolean(session)} />
      <main id="main">{children}</main>
      <Footer />
      <CookieBanner />
    </>
  );
}
