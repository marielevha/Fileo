import { mobileHandler, MobileApiError, ok, parseJsonBody, sessionPayload } from "@/lib/mobile/api";
import { getSupabaseSession, supabaseMobileAuth } from "@/lib/supabase/mobile-auth";

export const dynamic = "force-dynamic";

type RefreshBody = { refreshToken?: string };

export async function POST(request: Request) {
  return mobileHandler(async () => {
    const body = await parseJsonBody<RefreshBody>(request);
    const refreshToken = String(body.refreshToken ?? "").trim();
    if (!refreshToken) {
      throw new MobileApiError(400, "validation_error", "Token de renouvellement manquant.");
    }

    const { data, error } = await supabaseMobileAuth().auth.refreshSession({
      refresh_token: refreshToken,
    });
    if (error || !data.session) {
      throw new MobileApiError(401, "invalid_refresh_token", "La session a expire. Reconnectez-vous.");
    }

    const session = await getSupabaseSession(data.session.access_token);
    if (!session?.workshop) {
      throw new MobileApiError(403, "workshop_required", "Aucun atelier actif n'est associe a ce compte.");
    }

    return ok({
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      tokenType: "Bearer",
      expiresAt: new Date(data.session.expires_at! * 1000).toISOString(),
      ...sessionPayload(session as typeof session & { workshop: NonNullable<typeof session.workshop> }),
    });
  });
}
