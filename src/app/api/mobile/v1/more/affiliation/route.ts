import { AffiliateCodeError, createAffiliateProfile, getAffiliateOverviewForUser } from "@/lib/repos/affiliates";
import { MobileApiError, mobileHandler, ok, parseJsonBody, requireMobileSession } from "@/lib/mobile/api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request);
    return ok(await getAffiliateOverviewForUser(session.user.id));
  });
}

export async function POST(request: Request) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request);
    const body = await parseJsonBody<{ code?: unknown; autoGenerate?: unknown }>(request);
    let profile;
    try {
      profile = await createAffiliateProfile({
        userId: session.user.id,
        displayName: session.user.fullName,
        phone: session.user.phone,
        requestedCode: String(body.code ?? ""),
        autoGenerate: body.autoGenerate === true,
        actorUserId: session.user.id,
      });
    } catch (error) {
      if (error instanceof AffiliateCodeError) {
        throw new MobileApiError(400, error.code, error.message);
      }
      throw error;
    }
    return ok({ profile, overview: await getAffiliateOverviewForUser(session.user.id) });
  });
}
