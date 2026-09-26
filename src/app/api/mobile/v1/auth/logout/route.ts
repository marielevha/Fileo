import { bearerToken, mobileHandler, ok, requireMobileSession } from "@/lib/mobile/api";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { writeSupabaseAudit } from "@/lib/supabase/mobile-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return mobileHandler(async () => {
    const session = await requireMobileSession(request);
    const token = bearerToken(request);
    if (token) await supabaseAdmin().auth.admin.signOut(token, "local");
    await writeSupabaseAudit({
      workshopId: session.workshop.id,
      actorUserId: session.user.id,
      action: "auth.logout",
      entityKind: "user",
      entityId: session.user.id,
      after: { surface: "mobile" },
    });
    return ok({ loggedOut: true });
  });
}
