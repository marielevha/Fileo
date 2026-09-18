import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config";

const COOKIE = "fileo-locale";
const MOBILE_API_PREFIX = "/api/mobile/v1";
const MOBILE_API_METHODS = "GET, POST, PATCH, DELETE, OPTIONS";
const MOBILE_API_HEADERS = "Authorization, Content-Type, Accept, Origin";

function applyMobileCors(request: NextRequest, response: NextResponse) {
  const origin = request.headers.get("origin") ?? "*";
  response.headers.set("Access-Control-Allow-Origin", origin);
  response.headers.set("Access-Control-Allow-Methods", MOBILE_API_METHODS);
  response.headers.set("Access-Control-Allow-Headers", MOBILE_API_HEADERS);
  response.headers.set("Access-Control-Max-Age", "86400");
  response.headers.set("Vary", "Origin");
  return response;
}

function handleMobileApiCors(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith(MOBILE_API_PREFIX)) return null;
  if (request.method === "OPTIONS") {
    return applyMobileCors(request, new NextResponse(null, { status: 204 }));
  }
  return applyMobileCors(request, NextResponse.next());
}

function preferredLocale(request: NextRequest) {
  const saved = request.cookies.get(COOKIE)?.value;
  if (isLocale(saved)) return saved;
  const accepted = request.headers.get("accept-language")?.toLowerCase() ?? "";
  if (accepted.includes("ln")) return "lg";
  if (accepted.includes("en")) return "en";
  return DEFAULT_LOCALE;
}

export function middleware(request: NextRequest) {
  const mobileApiCors = handleMobileApiCors(request);
  if (mobileApiCors) return mobileApiCors;

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
  matcher: [
    "/api/mobile/v1/:path*",
    "/((?!api|_next/static|_next/image|icon.svg|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
