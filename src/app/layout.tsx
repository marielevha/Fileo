import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { site } from "@/lib/site";
import { DARK_THEME, LIGHT_THEME, STORAGE_KEY } from "@/lib/theme";

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

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  keywords: [
    "gestion atelier couture",
    "logiciel tailleur",
    "mesures clients",
    "suivi commandes couture",
    "Brazzaville",
    "Kinshasa",
  ],
  openGraph: {
    type: "website",
    locale: "fr_FR",
    url: site.url,
    siteName: site.name,
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
  },
  robots: { index: true, follow: true },
};

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inter.variable} ${outfit.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen">
        <a
          href="#main"
          className="btn btn-primary btn-sm sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100]"
        >
          Aller au contenu principal
        </a>
        {children}
      </body>
    </html>
  );
}
