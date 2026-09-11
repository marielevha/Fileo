import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";

const COOKIE = "fileo-locale";

function preferredLocale(request: NextRequest) {
  const saved = request.cookies.get(COOKIE)?.value;
  if (isLocale(saved)) return saved;
  const accepted = request.headers.get("accept-language")?.toLowerCase() ?? "";
  if (accepted.includes("ln")) return "lg";
  if (accepted.includes("en")) return "en";
  return DEFAULT_LOCALE;
}

export function middleware(request: NextRequest) {
  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  const locale = isLocale(segments[0]) ? segments[0] : undefined;
  const forwardedLocale = request.headers.get("x-fileo-locale") ?? undefined;

  if (!locale && isLocale(forwardedLocale)) {
    return NextResponse.next();
  }

  if (!locale) {
    const url = request.nextUrl.clone();
    const selected = preferredLocale(request);
    url.pathname = `/${selected}${request.nextUrl.pathname === "/" ? "" : request.nextUrl.pathname}`;
    return NextResponse.redirect(url);
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${segments.slice(1).join("/")}`;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-fileo-locale", locale);
  const response = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  response.cookies.set(COOKIE, locale, { sameSite: "lax", maxAge: 31_536_000, path: "/" });
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|icon.svg|favicon.ico|robots.txt|sitemap.xml).*)"],
};
