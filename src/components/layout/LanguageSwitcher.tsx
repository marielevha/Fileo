"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LOCALES, type Locale } from "@/lib/i18n/config";

const labels: Record<Locale, string> = { fr: "FR", en: "EN", lg: "LG" };

export default function LanguageSwitcher({
  locale,
  label,
}: {
  locale: Locale;
  label: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  function changeLocale(nextLocale: Locale) {
    const segments = pathname.split("/").filter(Boolean);
    if (LOCALES.includes(segments[0] as Locale)) segments.shift();
    const path = `/${nextLocale}${segments.length ? `/${segments.join("/")}` : ""}`;
    const query = searchParams.toString();
    router.push(query ? `${path}?${query}` : path);
  }

  return (
    <label className="flex items-center" aria-label={label}>
      <span className="sr-only">{label}</span>
      <select
        value={locale}
        onChange={(event) => changeLocale(event.target.value as Locale)}
        className="select select-ghost select-sm ml-1 w-16"
      >
        {LOCALES.map((item) => <option key={item} value={item}>{labels[item]}</option>)}
      </select>
    </label>
  );
}
