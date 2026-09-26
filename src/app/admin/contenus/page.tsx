import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/app/PageHeader";
import { requireAdmin } from "@/lib/auth/guards";
import { getLocale } from "@/lib/i18n/request";
import { isLocale, localePath, LOCALES } from "@/lib/i18n/config";
import { listFaqTranslations } from "@/lib/repos/faq";
import FaqEditor from "./FaqEditor";

export const metadata: Metadata = {
  title: "FAQ - Administration",
  robots: { index: false, follow: false },
};

const languageLabels = { fr: "FR", en: "EN", lg: "LG" } as const;

export default async function AdminContentPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string; lang?: string; new?: string }>;
}) {
  await requireAdmin("admin.contents");
  const [locale, rows, query] = await Promise.all([
    getLocale(), listFaqTranslations(), searchParams,
  ]);
  const baseHref = localePath(locale, "/admin/contenus");
  const slugs = [...new Set(rows.map((row) => row.slug))];
  const isNew = query.new === "1" || slugs.length === 0;
  const selectedSlug = isNew ? "" : slugs.includes(query.slug ?? "") ? query.slug! : slugs[0];
  const selectedLocale = isLocale(query.lang) ? query.lang : "fr";
  const selected = rows.find((row) => row.slug === selectedSlug && row.locale === selectedLocale) ?? null;

  return (
    <>
      <PageHeader
        title="Questions fréquentes"
        description="Gérez les réponses du site et de l'application, langue par langue. Seules les traductions publiées sont visibles."
        action={<Link href={`${baseHref}?new=1`} className="btn btn-primary">Nouvelle question</Link>}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(220px,300px)_minmax(0,1fr)]">
        <nav aria-label="Questions" className="border-base-300 bg-base-100 self-start rounded-lg border">
          {slugs.length ? slugs.map((slug) => {
            const translations = rows.filter((row) => row.slug === slug);
            const label = translations.find((row) => row.locale === "fr")?.title ?? translations[0].title;
            return (
              <Link
                key={slug}
                href={`${baseHref}?slug=${encodeURIComponent(slug)}&lang=${selectedLocale}`}
                aria-current={slug === selectedSlug ? "page" : undefined}
                className={`border-base-300 block border-b px-4 py-3 last:border-b-0 hover:bg-base-200 ${slug === selectedSlug ? "bg-base-200" : ""}`}
              >
                <span className="block text-sm font-medium">{label}</span>
                <span className="text-base-content/55 mt-1 block text-xs">{slug}</span>
                <span className="mt-2 flex gap-1.5">
                  {LOCALES.map((language) => {
                    const translation = translations.find((row) => row.locale === language);
                    return <span key={language} className={`badge badge-xs ${translation?.status === "published" ? "badge-success" : "badge-ghost"}`} title={translation?.status ?? "À traduire"}>{languageLabels[language]}</span>;
                  })}
                </span>
              </Link>
            );
          }) : <p className="text-base-content/60 p-4 text-sm">Aucune question pour le moment.</p>}
        </nav>

        <section className="border-base-300 bg-base-100 min-w-0 rounded-lg border">
          <div className="border-base-300 border-b px-5 py-4">
            <h2 className="font-display font-bold">{isNew ? "Nouvelle question" : selected?.title ?? "Nouvelle traduction"}</h2>
            {!isNew ? <div role="tablist" aria-label="Langue de la question" className="mt-4 flex gap-2">
              {LOCALES.map((language) => {
                const translation = rows.find((row) => row.slug === selectedSlug && row.locale === language);
                return <Link
                  key={language}
                  role="tab"
                  aria-selected={language === selectedLocale}
                  href={`${baseHref}?slug=${encodeURIComponent(selectedSlug)}&lang=${language}`}
                  className={`btn btn-sm ${language === selectedLocale ? "btn-primary" : "btn-ghost"}`}
                >{languageLabels[language]}{translation ? "" : " +"}</Link>;
              })}
            </div> : null}
          </div>
          <FaqEditor
            key={`${selectedSlug}:${selectedLocale}:${isNew}:${selected?.row_version ?? 0}`}
            baseHref={baseHref}
            isNew={isNew}
            locale={selectedLocale}
            row={selected}
            slug={selectedSlug}
            sortOrder={selected?.sort_order ?? rows.find((row) => row.slug === selectedSlug)?.sort_order ?? slugs.length + 1}
          />
        </section>
      </div>
    </>
  );
}
