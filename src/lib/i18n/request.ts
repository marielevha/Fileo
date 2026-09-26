import { headers } from "next/headers";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";

export async function getLocale(): Promise<Locale> {
  const value = (await headers()).get("x-fileo-locale") ?? undefined;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}
