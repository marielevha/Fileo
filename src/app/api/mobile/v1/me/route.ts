import { mobileHandler, ok, requireMobileSession, sessionPayload } from "@/lib/mobile/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request);
    return ok(sessionPayload(session));
  });
}
