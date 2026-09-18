import { NextResponse } from "next/server";
import { buildMobileOpenApi } from "@/lib/mobile/openapi";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  return NextResponse.json(buildMobileOpenApi(origin));
}
