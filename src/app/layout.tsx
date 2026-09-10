import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { site } from "@/lib/site";
import { DARK_THEME, LIGHT_THEME, STORAGE_KEY } from "@/lib/theme";
import { getLocale } from "@/lib/i18n/request";
import { getMessages } from "@/lib/i18n/messages";

/** Body / UI text: neutral, excellent at small sizes. */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

/** Display: geometric sans with more personality for headings and figures. */
const outfit = Outfit({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-outfit",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const copy = getMessages(locale);
  return {
    metadataBase: new URL(site.url),
    title: { default: `${site.name} - ${copy.meta.tagline}`, template: `%s | ${site.name}` },
    description: copy.meta.description,
    keywords: ["gestion atelier couture", "tailoring workshop software", "mesures clients", "Brazzaville", "Kinshasa"],
    openGraph: {
      type: "website",
      locale: locale === "fr" ? "fr_FR" : locale === "en" ? "en_US" : "ln_CD",
      url: `${site.url}/${locale}`,
      siteName: site.name,
      title: `${site.name} - ${copy.meta.tagline}`,
      description: copy.meta.description,
    },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    // Matches synthwave --color-base-100: oklch(15% .09 281.288).
    { media: "(prefers-color-scheme: dark)", color: "#1a0b2e" },
  ],
};

/**
 * Applies the stored theme before first paint so the page never flashes the
 * wrong palette. Kept inline and dependency-free on purpose.
 */
const themeScript = `
(function () {
  var LIGHT = ${JSON.stringify(LIGHT_THEME)};
  var DARK = ${JSON.stringify(DARK_THEME)};
  try {
    var stored = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
    if (stored !== LIGHT && stored !== DARK) stored = null;
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute("data-theme", stored || (prefersDark ? DARK : LIGHT));
  } catch (e) {
    document.documentElement.setAttribute("data-theme", LIGHT);
  }
})();
`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const copy = getMessages(locale);

  return (
    <html lang={locale === "lg" ? "ln" : locale} className={`${inter.variable} ${outfit.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen">
        <a
          href="#main"
          className="btn btn-primary btn-sm sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100]"
        >
          {copy.skip}
        </a>
        {children}
      </body>
    </html>
  );
}
