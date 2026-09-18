import { recordAudit } from "@/lib/audit";
import { destroySessionToken } from "@/lib/auth/session";
import { bearerToken, mobileHandler, ok, requireMobileSession } from "@/lib/mobile/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request);
    const token = bearerToken(request);
    if (token) await destroySessionToken(token);
    await recordAudit({
      actorUserId: session.user.id,
      action: "auth.logout",
      entityKind: "user",
      entityId: session.user.id,
      after: { surface: "mobile" },
    });
    return ok({ loggedOut: true });
  });
}
