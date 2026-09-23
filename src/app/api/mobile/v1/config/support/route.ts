import { mobileHandler, ok } from "@/lib/mobile/api";
import { getSupportContact } from "@/lib/repos/support-contact";

export const dynamic = "force-dynamic";

export async function GET() {
  return mobileHandler(async () => {
    const { email } = await getSupportContact();
    return ok({ supportEmail: email }, { headers: { "Cache-Control": "no-store" } });
  });
}
