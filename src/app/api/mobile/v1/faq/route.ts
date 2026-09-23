import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";
import { MobileApiError, mobileHandler, ok } from "@/lib/mobile/api";
import { listPublished } from "@/lib/repos/contents";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return mobileHandler(async () => {
    const value = new URL(request.url).searchParams.get("lang") ?? DEFAULT_LOCALE;
    if (!isLocale(value)) throw new MobileApiError(400, "invalid_locale", "Langue non prise en charge.");
    const rows = await listPublished("faq", 100, value);
    return ok({
      locale: value,
      items: rows.map((row) => ({ id: row.slug, question: row.title, answer: row.body ?? "" })),
    });
  });
}
